/**
 * Cifras reales de Paloma (Decantopia), junio–noviembre 2025. CLP.
 * Sirven como fuente de verdad para el desglose detallado del Estado de
 * Resultado y como fallback cuando el backend no está disponible (modo demo).
 *
 * Los totales coinciden exactamente con lo que calcula el backend.
 */
export const SALDO_INICIAL = 5000000; // saldo de apertura (igual al backend)
export const INVERSION_MKT = 1200000; // baseline de inversión en marketing (ROAS)

export const PALOMA_MESES = [
  { key: '2025-06', nombre: 'Junio',      corto: 'Jun', ventas: 10503450, cogsProd: 2931718, cogsEnvio: 853340,  cogsTrans: 399131, empleados: 2424544, herramientas: 96790, otros: 500000 },
  { key: '2025-07', nombre: 'Julio',      corto: 'Jul', ventas: 6048917,  cogsProd: 2141525, cogsEnvio: 605236,  cogsTrans: 229859, empleados: 1451000, herramientas: 90860, otros: 695000 },
  { key: '2025-08', nombre: 'Agosto',     corto: 'Ago', ventas: 6312455,  cogsProd: 2102253, cogsEnvio: 724687,  cogsTrans: 239873, empleados: 1030000, herramientas: 99750, otros: 0 },
  { key: '2025-09', nombre: 'Septiembre', corto: 'Sep', ventas: 9398648,  cogsProd: 3371893, cogsEnvio: 954638,  cogsTrans: 357149, empleados: 1030000, herramientas: 99750, otros: 0 },
  { key: '2025-10', nombre: 'Octubre',    corto: 'Oct', ventas: 14054350, cogsProd: 7014026, cogsEnvio: 1355337, cogsTrans: 534065, empleados: 1030000, herramientas: 99750, otros: 0 },
  { key: '2025-11', nombre: 'Noviembre',  corto: 'Nov', ventas: 10790228, cogsProd: 4148202, cogsEnvio: 980222,  cogsTrans: 410029, empleados: 1030000, herramientas: 99750, otros: 0 },
];
