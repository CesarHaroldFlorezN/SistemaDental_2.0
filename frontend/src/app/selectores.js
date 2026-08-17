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

export const fechaMovimiento = (valor) => {
  if (!valor) return null;
  const texto = String(valor);
  const fecha = new Date(texto.length === 10 ? `${texto}T12:00:00` : texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export const construirMovimientosCaja = (
  pagos,
  movimientos = [],
  pacientes = []
) => {
  const pagosPorId = new Map(
    pagos.map((pago) => [Number(pago.id), pago])
  );
  const netoPorPago = new Map();

  const resultado = movimientos
    .map((movimiento) => {
      const pagoId = Number(movimiento.pagoId || 0);
      const pago = pagosPorId.get(pagoId) || {};
      const ingreso = Number(movimiento.abono || 0);
      const egreso = Number(movimiento.cargo || 0);
      if (pagoId) {
        netoPorPago.set(
          pagoId,
          (netoPorPago.get(pagoId) || 0) + ingreso - egreso
        );
      }
      const paciente = pacientePorId(
        pacientes,
        movimiento.pacienteId ?? pago.pacienteId
      );
      return {
        id: `movimiento-${movimiento.id}`,
        movimientoId: movimiento.id,
        pagoId: pagoId || null,
        pacienteId: movimiento.pacienteId ?? pago.pacienteId ?? null,
        nombrePaciente:
          paciente.nombre || pago.nombrePaciente || 'Paciente no identificado',
        codigoFicha: paciente.codigo_ficha || pago.codigoFicha || '',
        fecha: movimiento.creadoEn || movimiento.fecha,
        tipo: movimiento.tipo || (ingreso > 0 ? 'pago' : 'egreso'),
        descripcion:
          movimiento.descripcion || pago.concepto || 'Movimiento de caja',
        metodo: movimiento.metodo || pago.metodo || '—',
        referencia: movimiento.referencia || '',
        ingreso,
        egreso
      };
    })
    .filter((movimiento) => movimiento.ingreso > 0 || movimiento.egreso > 0);

  pagos.forEach((pago) => {
    const cobrado = Number(pago.cobrado || 0);
    const legado = cobrado - Number(netoPorPago.get(Number(pago.id)) || 0);
    if (legado <= 0.005) return;
    const paciente = pacientePorId(pacientes, pago.pacienteId);
    resultado.push({
      id: `pago-historico-${pago.id}`,
      movimientoId: null,
      pagoId: pago.id,
      pacienteId: pago.pacienteId,
      nombrePaciente:
        paciente.nombre || pago.nombrePaciente || 'Paciente no identificado',
      codigoFicha: paciente.codigo_ficha || pago.codigoFicha || '',
      fecha: pago.fechaUltPago || pago.creadoEn || pago.fecha,
      tipo: 'pago_anterior',
      descripcion: `Pago anterior: ${pago.concepto || 'Atención dental'}`,
      metodo: pago.metodo || 'Pago registrado',
      referencia: '',
      ingreso: legado,
      egreso: 0
    });
  });

  return resultado.sort((a, b) => {
    const fechaA = fechaMovimiento(a.fecha)?.getTime() || 0;
    const fechaB = fechaMovimiento(b.fecha)?.getTime() || 0;
    return fechaB - fechaA;
  });
};

export const filtrarMovimientosCajaPorPeriodo = (
  movimientos,
  periodo,
  ahora = new Date()
) => {
  if (periodo === 'historico') return movimientos;

  const inicioDia = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate()
  );
  const finDia = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
    23,
    59,
    59,
    999
  );
  let inicio = inicioDia;

  if (periodo === 'semana') {
    inicio = new Date(inicioDia);
    const diasDesdeLunes = (inicio.getDay() + 6) % 7;
    inicio.setDate(inicio.getDate() - diasDesdeLunes);
  } else if (periodo === 'mes') {
    inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  } else if (periodo === 'anio') {
    inicio = new Date(ahora.getFullYear(), 0, 1);
  }

  return movimientos.filter((movimiento) => {
    const fecha = fechaMovimiento(movimiento.fecha);
    return fecha && fecha >= inicio && fecha <= finDia;
  });
};

export const calcularResumenFinanzas = (pagos, movimientos = []) => {
  const ahora = new Date();
  const inicioDia = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate()
  );
  const inicioSemana = new Date(inicioDia);
  const diaSemana = (inicioSemana.getDay() + 6) % 7;
  inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1);

  const ingresos = construirMovimientosCaja(pagos, movimientos).map(
    (movimiento) => ({
      fecha: fechaMovimiento(movimiento.fecha),
      monto: movimiento.ingreso - movimiento.egreso
    })
  );

  const sumarDesde = (inicio = null) => ingresos.reduce((total, ingreso) => {
    if (!ingreso.fecha || (inicio && ingreso.fecha < inicio)) return total;
    return total + ingreso.monto;
  }, 0);

  return {
    totalCobrado: pagos.reduce(
      (total, pago) => total + Number.parseFloat(pago.cobrado || 0),
      0
    ),
    ingresosHoy: sumarDesde(inicioDia),
    ingresosSemana: sumarDesde(inicioSemana),
    ingresosMes: sumarDesde(inicioMes),
    ingresosAnio: sumarDesde(inicioAnio),
    ingresosHistoricos: sumarDesde(),
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
