/**
 * Vercel Serverless Function — Fintoc: lista cuentas de un link.
 * La SECRET KEY vive solo en el servidor (env FINTOC_SECRET_KEY), nunca en el
 * frontend. Si no está configurada, responde 501 y el front usa Carga Manual.
 *
 * GET /api/fintoc/accounts?link_token=link_xxx
 */
export default async function handler(req, res) {
  const secret = process.env.FINTOC_SECRET_KEY;
  if (!secret) {
    return res.status(501).json({ error: 'Fintoc no está configurado (falta FINTOC_SECRET_KEY).' });
  }
  const linkToken = req.query?.link_token;
  if (!linkToken) {
    return res.status(400).json({ error: 'Falta link_token.' });
  }

  try {
    const r = await fetch(`https://api.fintoc.com/v1/accounts?link_token=${encodeURIComponent(linkToken)}`, {
      headers: { Authorization: secret },
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error: 'Error de la API de Fintoc.', detail });
    }
    const accounts = await r.json();
    return res.status(200).json({ accounts });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo contactar a Fintoc.', detail: String(e) });
  }
}
