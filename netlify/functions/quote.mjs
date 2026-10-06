const TOKEN = process.env.BRAPI_TOKEN;
const H = { headers: { Authorization: `Bearer ${TOKEN}` } };

async function chamar(url) {
  const r = await fetch(url, H);
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch {}
  return { ok: r.ok, status: r.status, j, txt: txt.slice(0, 200) };
}

async function buscar(t) {
  const base = `https://brapi.dev/api/quote/${encodeURIComponent(t)}`;
  let r = await chamar(`${base}?range=1y&interval=1mo&dividends=true`);
  const completo = r.ok;
  if (!r.ok) r = await chamar(base); // o plano pode não liberar histórico: tenta só o preço
  if (!r.ok) return { t, erro: r.status, msg: r.txt };

  const q = r.j?.results?.[0];
  if (!q || !(q.regularMarketPrice > 0)) return { t, erro: "sem preço", msg: r.txt };

  const price = q.regularMarketPrice;
  let chg1m = null, ret12 = null, yieldM = null;
  if (completo) {
    const h = (q.historicalDataPrice || []).filter((x) => x.close > 0).sort((a, b) => a.date - b.date);
    const umMesAtras = h.length > 1 ? h[h.length - 2].close : null;
    chg1m = umMesAtras ? (price / umMesAtras - 1) * 100 : null;
    ret12 = h.length ? (price / h[0].close - 1) * 100 : null;
    const limite = Date.now() - 365 * 864e5;
    const prov12 = (q.dividendsData?.cashDividends || [])
      .filter((d) => new Date(d.paymentDate).getTime() > limite)
      .reduce((soma, d) => soma + (d.rate || 0), 0);
    yieldM = (prov12 / price) * 100 / 12;
  }
  return { t, n: q.longName || q.shortName, price, chg1m, ret12, yieldM, completo };
}

export default async (req) => {
  const lista = (new URL(req.url).searchParams.get("t") || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (!lista.length) return Response.json({ results: [] });

  const todos = await Promise.all(
    lista.map((t) => buscar(t).catch((e) => ({ t, erro: "falha", msg: String(e) })))
  );
  const results = todos.filter((x) => x.price);
  const erros = todos.filter((x) => !x.price);
  return Response.json(
    { results, erros },
    { headers: erros.length ? {} : { "Netlify-CDN-Cache-Control": "public, s-maxage=300" } }
  );
};

export const config = { path: "/api/quote" };
