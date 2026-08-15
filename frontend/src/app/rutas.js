const RUTAS_POR_VISTA = {
  dashboard: '/',
  pacientes: '/pacientes',
  citas: '/agenda',
  planes: '/planes-tratamiento',
  finanzas: '/finanzas',
  planpagos: '/planes-pago',
  catalogo: '/catalogo-servicios',
  usuarios: '/usuarios'
};

const ROLES_POR_VISTA = {
  dashboard: ['administrador', 'odontologo', 'recepcion'],
  pacientes: ['administrador', 'odontologo', 'recepcion'],
  citas: ['administrador', 'odontologo', 'recepcion'],
  planes: ['administrador', 'odontologo'],
  finanzas: ['administrador', 'recepcion'],
  planpagos: ['administrador', 'recepcion'],
  catalogo: ['administrador'],
  usuarios: ['administrador']
};

export const rutaDeVista = (vista) => RUTAS_POR_VISTA[vista] || '/';

export const rutaPaciente = (pacienteId) =>
  `/pacientes/${Number.parseInt(pacienteId, 10)}`;

export const resolverRutaApp = (pathname = '/') => {
  const ruta = String(pathname || '/').replace(/\/+$/, '') || '/';
  const paciente = ruta.match(/^\/pacientes\/(\d+)$/);
  if (paciente) {
    return {
      vista: 'pacientes',
      pacienteId: Number.parseInt(paciente[1], 10)
    };
  }

  const vista = Object.entries(RUTAS_POR_VISTA).find(
    ([, valor]) => valor === ruta
  )?.[0];
  return { vista: vista || 'dashboard', pacienteId: null };
};

export const puedeAccederVista = (vista, rol) =>
  Boolean(ROLES_POR_VISTA[vista]?.includes(rol));
