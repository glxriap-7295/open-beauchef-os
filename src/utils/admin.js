/**
 * Lista de emails con acceso de administrador (el jefe de Open Beauchef).
 * Configúrala con VITE_ADMIN_EMAILS="jefe@openbeauchef.cl,otro@..."
 */
const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function esAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(String(email).toLowerCase());
}
