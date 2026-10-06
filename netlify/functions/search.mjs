const TOKEN = process.env.BRAPI_TOKEN;
const classe = (tipo) => (tipo === "bdr" ? "Exterior" : tipo === "fund" ? "Fundos imobiliários" : "Ações");

export default async (req) => {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return Response.json({ results: [] });
  const r = await fetch(
    `https://brapi.dev/api/quote/list?search=${encodeURIComponent(q)}&limit=8`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!r.ok) return Response.json({ error: "brapi", status: r.status }, { status: 502 });
  const j = await r.json();
  const results = (j.stocks || []).map((s) => ({ t: s.stock, n: s.name, c: classe(s.type) }));
  return Response.json({ results }, { headers: { "Netlify-CDN-Cache-Control": "public, s-maxage=3600" } });
};

export const config = { path: "/api/search" };
