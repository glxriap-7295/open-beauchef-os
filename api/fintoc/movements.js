/**
 * Vercel Serverless Function — Fintoc: movimientos de una cuenta.
 * Primera sincronización (sin `since`): últimos 90 días.
 * Siguientes: `since` = última sync (solo movimientos nuevos).
 * Nunca se re-descarga todo el historial.
 *
 * GET /api/fintoc/movements?link_token=...&account_id=...&since=YYYY-MM-DD
 */
const MAX_PAGES = 20;

export default async function handler(req, res) {
  const secret = process.env.FINTOC_SECRET_KEY;
  if (!secret) {
    return res.status(501).json({ error: 'Fintoc no está configurado (falta FINTOC_SECRET_KEY).' });
  }
  const { link_token: linkToken, account_id: accountId } = req.query || {};
  if (!linkToken || !accountId) {
    return res.status(400).json({ error: 'Faltan link_token o account_id.' });
  }

  const since = req.query.since || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    let url = `https://api.fintoc.com/v1/accounts/${encodeURIComponent(accountId)}/movements` +
      `?link_token=${encodeURIComponent(linkToken)}&since=${since}&per_page=300`;
    const movimientos = [];
    let pages = 0;

    while (url && pages < MAX_PAGES) {
      const r = await fetch(url, { headers: { Authorization: secret } });
      if (!r.ok) {
        const detail = await r.text();
        return res.status(r.status).json({ error: 'Error de la API de Fintoc.', detail });
      }
      const lote = await r.json();
      if (Array.isArray(lote)) movimientos.push(...lote);
      // Paginación por cabecera Link rel="next".
      const linkHeader = r.headers.get('link') || '';
      const next = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
      url = next ? next[1] : null;
      pages += 1;
    }

    return res.status(200).json({ movimientos });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo contactar a Fintoc.', detail: String(e) });
  }
}
