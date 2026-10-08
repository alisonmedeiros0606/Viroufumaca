const TOKEN = process.env.BRAPI_TOKEN;
const PLANO = (process.env.BRAPI_PLANO || "gratuito").toLowerCase();
const PAGO = PLANO !== "gratuito";
const AUTH = { headers: { Authorization: `Bearer ${TOKEN}` } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, AUTH);
    if (r.status !== 429) return r;
    await espera(500 * (i + 1));
  }
  return fetch(url, AUTH);
}

async function buscar(t) {
  const base = `https://brapi.dev/api/quote/${encodeURIComponent(t)}`;
  const extra = PAGO ? "?range=1y&interval=1mo&dividends=true" : "?range=3mo&interval=1d";
  let r = await chamar(base + extra);
  if (!r.ok) r = await chamar(base);
  if (!r.ok) return { t, erro: r.status };

  const q = (await r.json()).results?.[0];
  if (!q || !(q.regularMarketPrice > 0)) return { t, erro: "sem preço" };
  const price = q.regularMarketPrice;

  const h = (q.historicalDataPrice || []).filter((x) => x.close > 0).sort((a, b) => a.date - b.date);
  let chg1m = null;
  if (h.length > 1) {
    const alvo = Date.now() / 1000 - 30 * 86400;
    const ref = h.reduce((m, x) => (Math.abs(x.date - alvo) < Math.abs(m.date - alvo) ? x : m));
    chg1m = (price / ref.close - 1) * 100;
  }
  const ret12 = PAGO && h.length > 1 ? (price / h[0].close - 1) * 100 : null;

  let yieldM = null;
  if (PAGO) {
    const limite = Date.now() - 365 * 864e5;
    const prov12 = (q.dividendsData?.cashDividends || [])
      .filter((d) => new Date(d.paymentDate).getTime() > limite)
      .reduce((soma, d) => soma + (d.rate || 0), 0);
    yieldM = (prov12 / price) * 100 / 12;
  }
  return { t, n: q.longName || q.shortName, price, chg1m, ret12, yieldM };
}

export default async (req) => {
  const lista = (new URL(req.url).searchParams.get("t") || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 3);
  if (!lista.length) return Response.json({ results: [] });

  const todos = [];
  for (const t of lista) {
    todos.push(await buscar(t).catch((e) => ({ t, erro: "falha", msg: String(e) })));
  }
  const results = todos.filter((x) => x.price);
  const erros = todos.filter((x) => !x.price);
  return Response.json(
    { results, erros },
    { headers: erros.length ? {} : { "Netlify-CDN-Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
  );
};

export const config = { path: "/api/quote" };
