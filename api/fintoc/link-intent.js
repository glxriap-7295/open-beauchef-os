/**
 * Vercel Serverless Function — Fintoc: crea un Link Intent (producción).
 *
 * Flujo oficial (Movements): el backend crea un Link Intent con la SECRET KEY
 * y devuelve su `widget_token`; el frontend abre el widget con
 * Fintoc.create({ publicKey, widgetToken }). La secret key vive SOLO aquí.
 *
 * POST /api/fintoc/link-intent   body: { holderType?: 'business'|'individual' }
 * -> { widget_token }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const secret = process.env.FINTOC_SECRET_KEY;
  if (!secret) {
    return res.status(501).json({ error: 'Fintoc no está configurado (falta FINTOC_SECRET_KEY).' });
  }

  const holderType = (req.body && req.body.holderType) || 'business';
  const country = process.env.FINTOC_COUNTRY || 'cl';

  try {
    const r = await fetch('https://api.fintoc.com/v1/link_intents', {
      method: 'POST',
      headers: { Authorization: secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'movements', country, holder_type: holderType }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: 'No se pudo crear la conexión de Fintoc.', detail: data });
    }
    const widgetToken = data.widget_token || data.widgetToken;
    if (!widgetToken) {
      return res.status(502).json({ error: 'Fintoc no devolvió un widget_token.', detail: data });
    }
    return res.status(200).json({ widget_token: widgetToken });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo contactar a Fintoc.', detail: String(e) });
  }
}
