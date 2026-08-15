export const normalizarTextoCatalogo = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const CODIGO_POR_ALIAS = {
  evaluacion: 'consulta-evaluacion',
  'consulta de evaluacion': 'consulta-evaluacion',
  'limpieza dental': 'profilaxis-limpieza',
  profilaxis: 'profilaxis-limpieza',
  'endodoncia canal': 'endodoncia',
  'extraccion muela juicio': 'extraccion-muela-juicio',
  blanqueamiento: 'blanqueamiento-dental',
  'ortodoncia colocacion': 'ortodoncia-colocacion',
  'ortodoncia control': 'ortodoncia-control',
  'rayos x': 'radiografia-dental'
};

export const buscarServicioCatalogo = (
  catalogo = [],
  { servicioId = null, nombre = '' } = {}
) => {
  if (servicioId) {
    const porId = catalogo.find(
      (servicio) => Number(servicio.id) === Number(servicioId)
    );
    if (porId) return porId;
  }

  const clave = normalizarTextoCatalogo(nombre);
  const codigoAlias = CODIGO_POR_ALIAS[clave];
  if (codigoAlias) {
    const porAlias = catalogo.find(
      (servicio) => servicio.codigo === codigoAlias
    );
    if (porAlias) return porAlias;
  }

  return (
    catalogo.find(
      (servicio) => normalizarTextoCatalogo(servicio.nombre) === clave
    ) || null
  );
};

export const serviciosCatalogoDisponibles = (
  catalogo = [],
  servicioIdActual = null
) =>
  catalogo.filter(
    (servicio) =>
      servicio.activo || Number(servicio.id) === Number(servicioIdActual)
  );
