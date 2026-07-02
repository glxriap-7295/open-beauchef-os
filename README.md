<<<<<<< HEAD
# Open Beauchef OS — Frontend (V1.0)

Sistema operativo para startups de **Paloma (Decantopia)**. Incluye el
**Financial Copilot** original más la experiencia completa del emprendedor:
Panel Principal, AI Discovery, Startup Profile, Evidence Vault, Gap Analysis,
Roadmap, Mentores y conexión de datos financieros (Open Banking / Carga Manual).
Todo en español.

> Landing → Panel Principal → Centro de Herramientas → Copiloto Financiero.

## Novedades V1.0

- **AI Discovery** — sube evidencia, la IA la analiza y conversa (estilo ChatGPT)
  preguntando solo lo que falta, actualizando el Startup Profile en vivo.
  Proveedor por defecto **Ollama** (local), con **fallback automático** a un
  asistente mock si Ollama no está disponible. Arquitectura `AIProvider`
  intercambiable (Claude/OpenAI/Gemini futuros) sin tocar la UI.
- **Startup Profile** como única fuente de verdad (incluye TRL/BRL/CRL/IPRL,
  competencia, pricing, modelo de ingresos, equipo, finanzas, desafíos, metas).
  Todos los módulos lo consumen.
- **Evidence Vault** funcional: subir, renombrar, eliminar, vista previa y
  estados Subiendo → Analizando → Analizado.
- **Gap Analysis / Roadmap** dinámicos desde el perfil; completar sube la
  Preparación y puede desbloquear Mentor Matching.
- **Financial Copilot** conectable a datos reales: **Open Banking (Fintoc)** o
  **Carga Manual (CSV)**. Si Fintoc no está configurado, Carga Manual sigue
  funcionando. (No se modificaron los cálculos del Copiloto.)
- **Notificaciones de escritorio** (análisis completo, nueva recomendación,
  gasto por categorizar). Arquitectura lista para más proveedores.
- **PWA-ready** (manifest + metadatos) y **deploy en Vercel** (`vercel.json`).
- Persistencia con `LocalStorageProvider` por defecto y `FirebaseProvider`
  preparado (stub) para el futuro.

### Arquitectura de servicios (`src/services/`)

```
services/
  ai/           AIProvider intercambiable — ollamaProvider · mockProvider · index (SmartProvider + fallback)
  banking/      fintocProvider (Open Banking) · manualProvider (CSV) · index
  notifications/ notificaciones de escritorio (provider-swappable)
  persistence/  localStorageProvider (default) · firebaseProvider (stub)
```

La UI nunca conoce el proveedor concreto: pide `getAIProvider()`, `banking.*`,
`notifications.*`, `persistence.*`. Cambiar de proveedor es solo configuración.

### Variables de entorno

Todas son **opcionales** (la app corre en modo demo sin ninguna). Ver
`.env.example`. Claves principales: `VITE_AI_PROVIDER`, `VITE_OLLAMA_URL`,
`VITE_OLLAMA_MODEL`, `VITE_FINTOC_ENABLED`, `VITE_FINTOC_PUBLIC_KEY`,
`VITE_FINTOC_LINK_ENDPOINT`, `VITE_NOTIFY_PROVIDER`, `VITE_PERSISTENCE`,
`VITE_API_BASE`.

> Seguridad: la *secret key* de Fintoc **nunca** va en el frontend. El widget
> usa la public key y un `widgetToken` emitido por tu backend
> (`VITE_FINTOC_LINK_ENDPOINT`).

### Deploy en Vercel

1. Importa el repo en Vercel (framework detectado: Vite).
2. Define las variables de entorno que quieras activar (todas opcionales).
3. Deploy. `vercel.json` ya incluye el rewrite SPA para que las rutas funcionen
   al recargar.

---

## Financial Copilot (base)

Landing page → Dashboard → Reportería (Estado de Resultado + Flujo de Caja).
Datos de junio–noviembre 2025.

- **Stack:** React 18 (hooks) + Vite + React Router + Recharts + Axios
- **Estilos:** Tailwind CSS (vía Play CDN, sin paso de build extra)
- **Color de marca:** `#2E75B6` / blanco
- **Responsive:** mobile + desktop
- **Moneda:** CLP formateada como `$X.XXX.XXX`

---

## 1. Requisitos

- Node.js 18+ y npm.
- (Opcional) El backend de Financial Copilot corriendo en `http://localhost:3000`.
  El frontend funciona igual **sin backend**, mostrando datos demo reales de Paloma.

## 2. Instalación y arranque

```bash
npm install
cp .env.example .env     # opcional: ajusta VITE_API_BASE
npm run dev
```

Abre `http://localhost:5173`. Build de producción: `npm run build` y `npm run preview`.

## 3. Conexión con el backend

Variable de entorno en `.env`:

```
VITE_API_BASE=http://localhost:3000
```

> El backend de este proyecto expone las rutas en la raíz (`/auth`, `/reports`, …).
> Si tu backend las monta bajo `/api`, usa `VITE_API_BASE=http://localhost:3000/api`.

Endpoints consumidos:

- `POST /auth/login` — login automático con credenciales demo (`paloma@decantopia.cl` / `paloma1234`).
- `GET /startup/profile`
- `GET /reports/p-and-l?mes=YYYY-MM`
- `GET /reports/cash-flow`
- `GET /reports/runway`

**Manejo de errores:** si el backend no responde, el Dashboard muestra un aviso
("Modo demo") y sigue 100% funcional usando las cifras reales de Paloma incluidas
en `src/data/palomaData.js`. La insignia en el Navbar indica el estado de conexión.

## 4. Funcionalidades

**Landing page** — título, subtítulo y descripción solicitados, botón
"Acceder al Dashboard →" que navega a `/dashboard` (sin login para la demo).

**Dashboard** — 4 métricas clave (Promedio Mensual con tendencia ↑/↓, EBITDA
Promedio con % de margen, Runway Estimado, Saldo Actual) y gráfico de barras
Ingresos vs EBITDA con hover.

**Estado de Resultado (en español)**

- Toggle `Consolidado 6 meses` / `Mes a Mes`.
- Selector de mes clickeable: Junio · Julio · Agosto · Septiembre · Octubre · Noviembre.
- Desglose: Ingresos Totales, COGS (producción + envío + transacciones),
  Gastos Operacionales, EBITDA y Margen %.
- Gráfico de torta (pie) con hover que muestra los valores exactos.

**Flujo de Caja (en español)**

- **Histórico:** tabla mes a mes con Saldo Inicial · Dinero Entra · Dinero Sale ·
  Flujo Neto · Saldo Final.
- **Proyecciones:** 3 tarjetas de escenario (pesimista, realista destacado, optimista).
- **Slider dinámico** "Si los ingresos suben X%" (0–50%) que **recalcula en tiempo real**
  el saldo proyectado a 6 meses y el runway de cada escenario, con gráfico de líneas.

**Interactividad (Opción B+):** selector de mes, slider dinámico, charts con hover y
toggle consolidado/mes a mes — todo implementado.

## 5. Estructura

```
financial-copilot-frontend/
├── index.html              # Tailwind CDN + color de marca + fuente Inter
├── vite.config.js
├── package.json
├── .env.example
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx            # entrada + BrowserRouter
    ├── App.jsx             # rutas: / y /dashboard
    ├── api/
    │   └── client.js       # axios: login, profile, p-and-l, cash-flow, runway
    ├── context/
    │   └── PreparacionContext.jsx   # estado global de Nivel de Preparación
    ├── components/
    │   ├── Navbar.jsx
    │   ├── LandingPage.jsx
    │   ├── Dashboard.jsx        # 4 métricas + barras
    │   ├── EstadoResultado.jsx  # selector mes + pie + toggle
    │   ├── FlujoCaja.jsx        # tabla histórica + proyecciones + slider
    │   └── os/                  # shell del "sistema operativo" del emprendedor
    │       ├── AppLayout.jsx · Sidebar.jsx
    │       ├── NivelPreparacion.jsx · RecomendacionesIA.jsx · MentorBanner.jsx
    │       ├── CopilotoOnboardingModal.jsx · PricingCopiloto.jsx
    ├── pages/
    │   ├── HomePage.jsx
    │   ├── PanelPrincipal.jsx       # /app
    │   ├── CentroHerramientas.jsx   # /herramientas
    │   ├── CopilotoFinanciero.jsx   # /copiloto (modal premium)
    │   ├── WalkthroughFuturo.jsx    # /copiloto/futuro (6 pantallas)
    │   ├── Mentores.jsx             # /mentores
    │   └── DashboardPage.jsx    # demo financiera (+ banner Beta), /copiloto/demo y /dashboard
    ├── utils/
    │   ├── formatters.js   # CLP, %, meses
    │   └── calculations.js # P&L, EBITDA, flujo, runway, proyecciones
    └── data/
        └── palomaData.js   # cifras reales jun–nov 2025 (fuente de verdad / fallback)
```

## 5b. Experiencia "Open Beauchef OS" (emprendedor)

Sobre el Copiloto Financiero se construyó una experiencia tipo sistema operativo
para el emprendedor, sin tocar el motor financiero existente. Rutas:

| Ruta | Pantalla |
|------|----------|
| `/` | Landing |
| `/app` | **Panel Principal** — hero *Nivel de Preparación* (dimensiones, logros, tendencia), Recomendaciones IA, Mentor Matching, accesos rápidos |
| `/herramientas` | **Centro de Herramientas** — App Store de herramientas gratuitas + premium (glow/lock) + planes del Copiloto |
| `/copiloto` | **Copiloto Financiero IA** — modal premium de onboarding (Abrir demostración / Ver versión futura / Volver) |
| `/copiloto/demo` y `/dashboard` | **Demo financiera existente** con banner *Versión Demo (Beta)* |
| `/copiloto/futuro` | **Walkthrough futuro** de 6 pantallas (Conecta tu empresa → Open Banking → Motor IA → WhatsApp → Resultados → ¡Listo!) |
| `/mentores` | **Mentores** — se desbloquea al alcanzar el hito de preparación |

Estado compartido en `src/context/PreparacionContext.jsx`: el nivel de preparación
se deriva del promedio de dimensiones y **mejora al completar el walkthrough**
(la dimensión Finanzas sube, se registra un logro, se actualizan las recomendaciones
y, al cruzar el umbral, se desbloquea Mentor Matching). Persiste en `localStorage`;
puedes reiniciarlo borrando la clave `ob_preparacion_v1`.

Todo el motor financiero original (Dashboard, Estado de Resultado, Flujo de Caja,
cálculos, charts, alertas) se mantiene intacto y sigue accesible.

## 6. Nota sobre las cifras

Las métricas del Dashboard se **calculan en vivo** a partir de los datos reales de
Paloma (no están hardcodeadas), por lo que reflejan los números exactos del negocio:
ingreso promedio ≈ $9,5M/mes, EBITDA promedio ≈ $3,0M (31,5% de margen),
saldo actual ≈ $23,0M. El runway se estima como saldo ÷ gasto mensual promedio.
Como el negocio es flujo-positivo, los escenarios de proyección pueden mostrar
runway "∞"; baja el % del slider o ajusta el saldo inicial para ver un runway finito.
=======
# open-beauchef-os
>>>>>>> d907c2ea7518dcf9ffaf6338f3218b89a334f499
