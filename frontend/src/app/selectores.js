import { normalizarTexto } from '../shared/utils/dentalPro';

const contieneTerminos = (texto, busqueda) => {
  const terminos = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  if (!terminos.length) return true;

  const textoNormalizado = normalizarTexto(texto);
  return terminos.every((termino) => textoNormalizado.includes(termino));
};

const pacientePorId = (pacientes, pacienteId) =>
  pacientes.find((paciente) => Number(paciente.id) === Number(pacienteId)) || {};

export const filtrarPacientes = (pacientes, busqueda) =>
  pacientes
    .filter((paciente) =>
      contieneTerminos(
        [
          paciente.nombre,
          paciente.cedula,
          paciente.codigo_ficha,
          paciente.telefono,
          paciente.correo
        ].join(' '),
        busqueda
      )
    )
    .sort((a, b) => {
      const numA =
        Number.parseInt((a.codigo_ficha || '').replace(/\D/g, ''), 10) ||
        999999;
      const numB =
        Number.parseInt((b.codigo_ficha || '').replace(/\D/g, ''), 10) ||
        999999;
      if (numA !== numB) return numA - numB;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

export const enriquecerCitas = (citas, pacientes) =>
  citas.map((cita) => {
    const paciente = pacientePorId(pacientes, cita.pacienteId);
    return {
      ...cita,
      nombrePaciente: paciente.nombre || 'Paciente no encontrado',
      cedulaPaciente: paciente.cedula || '—',
      codigoFicha: paciente.codigo_ficha || '',
      telefonoPaciente: paciente.telefono || '—'
    };
  });

export const enriquecerPagos = (pagos, pacientes) =>
  pagos.map((pago) => {
    const paciente = pacientePorId(pacientes, pago.pacienteId);
    return {
      ...pago,
      nombrePaciente: paciente.nombre || 'Paciente no encontrado',
      cedulaPaciente: paciente.cedula || '—',
      codigoFicha: paciente.codigo_ficha || '',
      telefonoPaciente: paciente.telefono || '—'
    };
  });

export const filtrarPagos = (pagos, busqueda, filtro) =>
  pagos
    .filter((pago) => {
      const saldo = Number.parseFloat(pago.saldo || 0);
      if (filtro === 'pendientes') return saldo > 0;
      if (filtro === 'aldia') return saldo <= 0;
      return true;
    })
    .filter((pago) =>
      contieneTerminos(
        [
          pago.nombrePaciente,
          pago.cedulaPaciente,
          pago.codigoFicha,
          pago.telefonoPaciente,
          pago.concepto,
          pago.metodo,
          pago.tipoPago
        ].join(' '),
        busqueda
      )
    )
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

const enriquecerPlan = (plan, pacientes) => {
  const paciente = pacientePorId(pacientes, plan.pacienteId);
  return {
    ...plan,
    nombrePaciente: paciente.nombre || 'Paciente no encontrado',
    telefonoPaciente: paciente.telefono || '—',
    codigoFicha: paciente.codigo_ficha || ''
  };
};

export const filtrarPlanesPago = (planes, pacientes, busqueda) =>
  planes
    .map((plan) => enriquecerPlan(plan, pacientes))
    .filter((plan) =>
      contieneTerminos(
        [plan.nombrePaciente, plan.concepto, plan.codigoFicha].join(' '),
        busqueda
      )
    )
    .sort((a, b) =>
      (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')
    );

export const filtrarPlanesTratamiento = (planes, pacientes, busqueda) =>
  planes
    .map((plan) => enriquecerPlan(plan, pacientes))
    .filter((plan) =>
      contieneTerminos(
        [plan.nombrePaciente, plan.nombre, plan.tipo, plan.codigoFicha].join(
          ' '
        ),
        busqueda
      )
    )
    .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));

export const calcularResumenFinanzas = (pagos) => {
  const mesActual = new Date().toISOString().slice(0, 7);
  return {
    totalCobrado: pagos.reduce(
      (total, pago) => total + Number.parseFloat(pago.cobrado || 0),
      0
    ),
    ingresosMes: pagos
      .filter((pago) =>
        (pago.fechaUltPago || pago.fecha || '').startsWith(mesActual)
      )
      .reduce(
        (total, pago) => total + Number.parseFloat(pago.cobrado || 0),
        0
      ),
    financiadoActivo: pagos
      .filter((pago) => (pago.tipoPago || '').toLowerCase() === 'cuotas')
      .reduce(
        (total, pago) => total + Number.parseFloat(pago.saldo || 0),
        0
      ),
    porCobrarTotal: pagos.reduce(
      (total, pago) => total + Number.parseFloat(pago.saldo || 0),
      0
    )
  };
};
