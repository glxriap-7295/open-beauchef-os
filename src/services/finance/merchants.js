/**
 * Base de conocimiento de COMERCIOS (merchant knowledge base).
 * ============================================================================
 * Es SOLO DATOS. Agregar un comercio = agregar un objeto aquí; NUNCA se toca la
 * lógica de negocio (categorize.js). Pensada para escalar a miles de comercios
 * y, más adelante, migrar a Firestore/CDN sin cambiar el motor.
 *
 * Esquema de cada comercio:
 *   {
 *     id:         string   // ID ESTABLE (slug). No cambia aunque cambie el nombre.
 *     merchant:   string   // nombre visible para el usuario
 *     categoryId: string   // id de categoría contable (ver CATEGORY_REGISTRY)
 *     aliases:    string[] // variantes en minúsculas; se buscan como substring
 *     patterns?:  string[] // regex (string) para variantes con números/códigos
 *     categoryBySign?: { in: categoryId, out: categoryId }
 *       // Procesadores de pago: un ingreso es revenue; un egreso es bank_fees.
 *   }
 *
 * Reglas de datos:
 *   · `id` estable en kebab-case; NUNCA reutilizar un id para otro comercio.
 *   · aliases en minúsculas y sin acentos, para match estable.
 *   · preferir un alias específico ("mercado pago") sobre uno genérico ("pago").
 * ============================================================================
 */

export const MERCHANTS = [
  // ── Software / SaaS ────────────────────────────────────────────────
  { id: 'aws', merchant: 'Amazon Web Services', categoryId: 'software', aliases: ['aws', 'aws emea', 'amazon web services', 'amazonaws', 'amazon web s'] },
  { id: 'google-workspace', merchant: 'Google Workspace', categoryId: 'software', aliases: ['google workspace', 'google gsuite', 'gsuite', 'google cloud', 'google svcs', 'google *'] },
  { id: 'microsoft', merchant: 'Microsoft', categoryId: 'software', aliases: ['microsoft', 'msft', 'office 365', 'office365', 'microsoft 365', 'azure'] },
  { id: 'openai', merchant: 'OpenAI', categoryId: 'software', aliases: ['openai', 'chatgpt'] },
  { id: 'notion', merchant: 'Notion', categoryId: 'software', aliases: ['notion'] },
  { id: 'slack', merchant: 'Slack', categoryId: 'software', aliases: ['slack'] },
  { id: 'zoom', merchant: 'Zoom', categoryId: 'software', aliases: ['zoom'] },
  { id: 'canva', merchant: 'Canva', categoryId: 'software', aliases: ['canva'] },
  { id: 'figma', merchant: 'Figma', categoryId: 'software', aliases: ['figma'] },
  { id: 'github', merchant: 'GitHub', categoryId: 'software', aliases: ['github'] },
  { id: 'adobe', merchant: 'Adobe', categoryId: 'software', aliases: ['adobe'] },
  { id: 'vercel', merchant: 'Vercel', categoryId: 'software', aliases: ['vercel'] },
  { id: 'cloudflare', merchant: 'Cloudflare', categoryId: 'software', aliases: ['cloudflare'] },
  { id: 'hubspot', merchant: 'HubSpot', categoryId: 'software', aliases: ['hubspot'] },
  { id: 'mailchimp', merchant: 'Mailchimp', categoryId: 'software', aliases: ['mailchimp', 'intuit mailchimp'] },

  // ── Marketing / Ads ────────────────────────────────────────────────
  { id: 'meta-ads', merchant: 'Meta Ads', categoryId: 'marketing', aliases: ['meta ads', 'meta platforms', 'facebook ads', 'facebk', 'fb ads', 'instagram ads'] },
  { id: 'google-ads', merchant: 'Google Ads', categoryId: 'marketing', aliases: ['google ads', 'google adwords', 'adwords'] },
  { id: 'tiktok-ads', merchant: 'TikTok Ads', categoryId: 'marketing', aliases: ['tiktok ads', 'bytedance'] },
  { id: 'linkedin-ads', merchant: 'LinkedIn Ads', categoryId: 'marketing', aliases: ['linkedin'] },

  // ── Envíos / Logística ─────────────────────────────────────────────
  { id: 'bluexpress', merchant: 'Bluexpress', categoryId: 'shipping', aliases: ['bluexpress', 'blue express'] },
  { id: 'chilexpress', merchant: 'Chilexpress', categoryId: 'shipping', aliases: ['chilexpress'] },
  { id: 'starken', merchant: 'Starken', categoryId: 'shipping', aliases: ['starken'] },
  { id: 'correos-chile', merchant: 'Correos de Chile', categoryId: 'shipping', aliases: ['correos de chile', 'correoschile'] },
  { id: 'shipit', merchant: 'Shipit', categoryId: 'shipping', aliases: ['shipit'] },

  // ── Marketplace ────────────────────────────────────────────────────
  { id: 'mercado-libre', merchant: 'Mercado Libre', categoryId: 'marketplace', aliases: ['mercado libre', 'mercadolibre', 'mercadolib'] },
  { id: 'shopify', merchant: 'Shopify', categoryId: 'marketplace', aliases: ['shopify'] },
  { id: 'falabella', merchant: 'Falabella', categoryId: 'marketplace', aliases: ['falabella'] },
  { id: 'ripley', merchant: 'Ripley', categoryId: 'marketplace', aliases: ['ripley'] },
  { id: 'paris', merchant: 'Paris', categoryId: 'marketplace', aliases: ['paris.cl', 'cencosud paris'] },

  // ── Procesadores de pago (sign-aware: entrada=revenue, salida=bank_fees) ──
  { id: 'stripe', merchant: 'Stripe', categoryId: 'revenue', aliases: ['stripe'], categoryBySign: { in: 'revenue', out: 'bank_fees' } },
  { id: 'transbank', merchant: 'Transbank / Webpay', categoryId: 'revenue', aliases: ['transbank', 'webpay', 'redcompra'], categoryBySign: { in: 'revenue', out: 'bank_fees' } },
  { id: 'getnet', merchant: 'Getnet', categoryId: 'revenue', aliases: ['getnet'], categoryBySign: { in: 'revenue', out: 'bank_fees' } },
  { id: 'flow', merchant: 'Flow', categoryId: 'revenue', aliases: ['flow.cl', 'pago flow'], categoryBySign: { in: 'revenue', out: 'bank_fees' } },
  { id: 'khipu', merchant: 'Khipu', categoryId: 'revenue', aliases: ['khipu'], categoryBySign: { in: 'revenue', out: 'bank_fees' } },
  { id: 'mercado-pago', merchant: 'Mercado Pago', categoryId: 'revenue', aliases: ['mercado pago', 'mercadopago'], categoryBySign: { in: 'revenue', out: 'bank_fees' } },
  { id: 'fintoc', merchant: 'Fintoc', categoryId: 'bank_fees', aliases: ['fintoc'] },

  // ── Impuestos / Estado ─────────────────────────────────────────────
  { id: 'sii', merchant: 'SII (Tesorería)', categoryId: 'taxes', aliases: ['sii', 'tesoreria general', 'tgr', 'impuestos internos'] },

  // ── Remuneraciones / Previsión ─────────────────────────────────────
  { id: 'previred', merchant: 'Previred', categoryId: 'payroll', aliases: ['previred'] },
  { id: 'afp', merchant: 'AFP', categoryId: 'payroll', aliases: ['afp capital', 'afp habitat', 'afp provida', 'afp modelo', 'afp cuprum', 'afp planvital'] },
  { id: 'salud-prevision', merchant: 'Isapre / Fonasa', categoryId: 'payroll', aliases: ['isapre', 'fonasa', 'banmedica', 'colmena', 'cruz blanca', 'consalud'] },

  // ── Servicios básicos / Utilities ──────────────────────────────────
  { id: 'enel', merchant: 'Enel', categoryId: 'utilities', aliases: ['enel'] },
  { id: 'cge', merchant: 'CGE', categoryId: 'utilities', aliases: ['cge'] },
  { id: 'aguas-andinas', merchant: 'Aguas Andinas', categoryId: 'utilities', aliases: ['aguas andinas'] },
  { id: 'movistar', merchant: 'Movistar', categoryId: 'utilities', aliases: ['movistar'] },
  { id: 'entel', merchant: 'Entel', categoryId: 'utilities', aliases: ['entel'] },
  { id: 'wom', merchant: 'WOM', categoryId: 'utilities', aliases: ['wom '] },
  { id: 'claro', merchant: 'Claro', categoryId: 'utilities', aliases: ['claro '] },
  { id: 'vtr-gtd', merchant: 'VTR / GTD', categoryId: 'utilities', aliases: ['vtr', 'gtd', 'mundo pacifico'] },
];
