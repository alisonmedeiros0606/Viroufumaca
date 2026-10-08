const TOKEN = process.env.BRAPI_TOKEN;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const classe = (s) => {
  const nome = (s.name || "").toUpperCase();
  if (s.type === "bdr") return "Exterior";
  if (s.type === "fund")
    return /S&P|NASDAQ|MSCI|EUA|AMERICA|GLOBAL|WORLD|EXTERIOR/.test(nome) ? "Exterior" : "Fundos imobiliários";
  return "Ações";
};

async function chamar(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.status !== 429) return r;
    await espera(500 * (i + 1));
  }
  return fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

export default async (req) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return Response.json({ results: [] });
  const r = await chamar(
    `https://brapi.dev/api/quote/list?search=${encodeURIComponent(q)}&sortBy=volume&sortOrder=desc&limit=30`
  );
  if (!r.ok) return Response.json({ error: "brapi", status: r.status }, { status: 502 });
  const j = await r.json();
  const results = (j.stocks || [])
    .filter((s) => !/\d{1,2}F$/.test(s.stock))
    .slice(0, 8)
    .map((s) => ({ t: s.stock, n: s.name, c: classe(s), price: s.close, chg: s.change }));
  return Response.json({ results }, { headers: { "Netlify-CDN-Cache-Control": "public, s-maxage=900" } });
};

export const config = { path: "/api/search" };
