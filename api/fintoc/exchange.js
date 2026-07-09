/**
 * Vercel Serverless Function — Fintoc: intercambia el exchange_token por el
 * link_token permanente (producción), usando la SECRET KEY server-side.
 *
 * POST /api/fintoc/exchange   body: { exchange_token }
 * -> { link_token }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const secret = process.env.FINTOC_SECRET_KEY;
  if (!secret) {
    return res.status(501).json({ error: 'Fintoc no está configurado (falta FINTOC_SECRET_KEY).' });
  }

  const exchangeToken = req.body && (req.body.exchange_token || req.body.exchangeToken);
  if (!exchangeToken) {
    return res.status(400).json({ error: 'Falta exchange_token.' });
  }

  try {
    const r = await fetch('https://api.fintoc.com/v1/link_intents/exchange', {
      method: 'POST',
      headers: { Authorization: secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange_token: exchangeToken }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: 'No se pudo completar la conexión de Fintoc.', detail: data });
    }
    const linkToken = data.link_token || data.link?.link_token || data.link?.id;
    if (!linkToken) {
      return res.status(502).json({ error: 'Fintoc no devolvió un link_token.', detail: data });
    }
    return res.status(200).json({ link_token: linkToken });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo contactar a Fintoc.', detail: String(e) });
  }
}
