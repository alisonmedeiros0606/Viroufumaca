const TOKEN = process.env.BRAPI_TOKEN;

async function buscar(t) {
  const r = await fetch(
    `https://brapi.dev/api/quote/${encodeURIComponent(t)}?range=1y&interval=1mo&dividends=true`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!r.ok) return null;
  const q = (await r.json()).results?.[0];
  if (!q || !(q.regularMarketPrice > 0)) return null;
  const price = q.regularMarketPrice;
  const h = (q.historicalDataPrice || []).filter((x) => x.close > 0).sort((a, b) => a.date - b.date);
  const umMesAtras = h.length > 1 ? h[h.length - 2].close : null;
  const chg1m = umMesAtras ? (price / umMesAtras - 1) * 100 : null;
  const ret12 = h.length ? (price / h[0].close - 1) * 100 : null;
  const limite = Date.now() - 365 * 864e5;
  const prov12 = (q.dividendsData?.cashDividends || [])
    .filter((d) => new Date(d.paymentDate).getTime() > limite)
    .reduce((soma, d) => soma + (d.rate || 0), 0);
  const yieldM = prov12 ? (prov12 / price) * 100 / 12 : 0;
  return { t, n: q.longName || q.shortName, price, chg1m, ret12, yieldM };
}

export default async (req) => {
  const lista = (new URL(req.url).searchParams.get("t") || "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (!lista.length) return Response.json({ results: [] });
  const results = (await Promise.all(lista.map((t) => buscar(t).catch(() => null)))).filter(Boolean);
  return Response.json({ results }, { headers: { "Netlify-CDN-Cache-Control": "public, s-maxage=300" } });
};

export const config = { path: "/api/quote" };
