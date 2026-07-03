# 🚀 Desplegar Open Beauchef OS a Vercel — HOY

Todo el código está listo. Estos pasos los corres **tú** desde tu computador
(yo no tengo acceso a tu GitHub ni a tu Vercel). Toma ~10 minutos.

---

## 0. Requisitos
- Node.js 18+ instalado.
- Estás en la carpeta `financial-copilot-frontend`.

## 1. Instalar y probar local
```bash
npm install
npm run build      # debe terminar sin errores
npm run preview    # abre el sitio compilado
```
> Nota: `npm run dev` (Vite) sirve la app pero **no** las funciones `/api`
> (Fintoc). Para probar Fintoc en local usa `npx vercel dev`. En la nube
> (Vercel) las funciones `/api/fintoc/*` funcionan automáticamente.

## 2. Soltar el candado de git (si aparece)
OneDrive a veces bloquea `.git`. Si `git` se queja de `index.lock`:
```powershell
del .git\index.lock          # PowerShell (Windows)
# o:  rm -f .git/index.lock   # Mac/Linux
```

## 3. Commit + push a GitHub
```bash
git add -A
git commit -m "Pilot: generic OS, real Fintoc, manual import, auth, settings"
git push origin main
```
Repo remoto ya configurado: `glxriap-7295/open-beauchef-os`.

## 4. Deploy en Vercel
1. Entra a https://vercel.com → **Add New → Project** → importa
   `open-beauchef-os` (framework detectado: **Vite**).
2. **Environment Variables** (Project → Settings → Environment Variables):

   | Variable | Valor | Ámbito |
   |---|---|---|
   | `VITE_FINTOC_ENABLED` | `true` | Production |
   | `VITE_FINTOC_PUBLIC_KEY` | `pk_test_iz9foScinV5A18kBqya5Kh-_r1QyEPq3E52tm8henZk` | Production |
   | `VITE_FINTOC_LINK_ENDPOINT` | `/api/fintoc` | Production |
   | `FINTOC_SECRET_KEY` | *(tu `sk_test_…`)* | Production (server) |

   ⚠️ **`FINTOC_SECRET_KEY` NO lleva prefijo `VITE_`** — así queda solo en el
   servidor y nunca se expone al navegador.
3. **Deploy**. En 1–2 min tendrás la URL pública (p. ej.
   `https://open-beauchef-os.vercel.app`).

## 5. Rotar la secret key (recomendado)
Tu `sk_test_…` quedó visible en un screenshot. Es de **prueba** (sandbox, sin
dinero real), pero por higiene: Fintoc dashboard → API keys → rota la secret y
actualiza `FINTOC_SECRET_KEY` en Vercel.

---

## Cómo lo usan las 2 emprendedoras + tu jefe HOY

Cada persona abre la URL en **su propio navegador** y crea su cuenta
("Crear cuenta"). Su sesión queda guardada (no vuelve a pedir login hasta
"Cerrar sesión"). Flujo sugerido:

1. **Crear cuenta** → onboarding rápido (nombre + lo que tengan).
2. **AI Discovery** (Centro de Herramientas): suben Pitch Deck / docs → se llena
   el Startup Profile solo → responde lo que falte.
3. **Copiloto Financiero**: *Conectar con Fintoc* (banco de prueba) **o**
   *Subir CSV* (usa `sample-cartola.csv` incluido) **o** *Cargar dataset de
   ejemplo*.
4. **Copiloto Marketing**, **Gap Analysis**, **Roadmap**, **Configuración**.

### ⚠️ Importante sobre "multiusuario" y el admin
Hoy la persistencia es **LocalStorage por navegador** (sin base de datos
compartida). Consecuencias para el piloto:
- ✅ Las 2 emprendedoras pueden usar la app **de forma independiente**, cada una
  en su equipo, con sus propios datos aislados. Funciona perfecto.
- ✅ Tu jefe puede entrar y usar el producto como un usuario más.
- ❌ Tu jefe (admin) **no verá los datos de las emprendedoras** desde su cuenta:
  no hay backend compartido. Un panel de admin que vea a todos requiere una base
  de datos (Firebase/Supabase) — es la siguiente iteración, no es de hoy.

Si para la demo de hoy tu jefe necesita **ver** el trabajo de una emprendedora,
lo más simple es mirarlo **en el equipo/navegador de ella**, o que use "Cargar
dataset de ejemplo" para ver el Copiloto Financiero completo al instante.

## Sandbox de Fintoc
Con claves `pk_test`/`sk_test`, el widget de Fintoc abre en **modo prueba**:
elige un banco de prueba y usa las credenciales de sandbox que muestra Fintoc.
Importa cuentas y movimientos de los últimos 90 días hacia el Copiloto.
