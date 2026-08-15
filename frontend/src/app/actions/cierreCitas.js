import Swal from 'sweetalert2';
import { api } from '../../services/api';
import { obtenerFechaLocal } from '../../shared/utils/dentalPro';

export const crearAccionesCierreCitas = ({
  usuarioActual,
  pacientes,
  citas,
  pagos,
  planPagos,
  cargarCitas,
  cargarPagos,
  cargarPlanPagos,
  cargarPlanes,
  fMon,
  setPlanPagoContexto,
  setModalPPAbierto,
  setCitaParaAccion,
  setPagoParaAccion,
  setModalCompletarAbierto,
  setModalCancelarAbierto
}) => {
  const handleGuardarCompletado = async ({
    citaId,
    pacienteId,
    serviciosRealizados = [],
    serviciosNoRealizados = [],
    procedimiento,
    subtotal = 0,
    ajuste = {},
    totalFinal = 0,
    pagadoAnterior = 0,
    accionSaldo = 'dejar_pendiente',
    cobroHoy = 0,
    metodoPago = 'Pendiente',
    pagosMixtos = [],
    notasFin = ''
  }) => {
    try {
      const citaActual = citas.find((cita) => Number(cita.id) === Number(citaId));
      if (!citaActual) throw new Error('No se encontró la cita que se desea finalizar.');

      const pagoActual = pagos.find((pago) => Number(pago.citaId) === Number(citaId)) || null;
      const cobradoPrevio = Math.max(0, Number(pagoActual?.cobrado ?? pagadoAnterior ?? 0));
      const cobroRegistrado = accionSaldo === 'cobrar_ahora'
        ? Math.max(0, Number(cobroHoy || 0))
        : 0;
      const total = Math.max(0, Number(totalFinal || 0));
      const nuevoCobrado = Number((cobradoPrevio + cobroRegistrado).toFixed(2));
      const nuevoSaldo = Number(Math.max(0, total - nuevoCobrado).toFixed(2));
      const creditoFavor = Number(Math.max(0, nuevoCobrado - total).toFixed(2));

      let tipoPagoFinal = 'contado';
      if (total <= 0) tipoPagoFinal = 'cortesia';
      else if (accionSaldo === 'agregar_plan' && nuevoSaldo > 0) tipoPagoFinal = 'cuotas';
      else if (nuevoSaldo <= 0) tipoPagoFinal = 'completo';
      else if (nuevoCobrado > 0) tipoPagoFinal = 'anticipo';

      const detalleMixto = pagosMixtos
        .filter((parte) => Number(parte.monto || 0) > 0)
        .map((parte) => `${parte.metodo}: ${fMon(parte.monto)}`)
        .join(' + ');
      const metodoCompleto = metodoPago === 'Mixto' && detalleMixto
        ? `Mixto — ${detalleMixto}`
        : metodoPago;
      const metodoRegistro = cobroRegistrado > 0
        ? String(metodoCompleto || 'Efectivo').slice(0, 50)
        : (pagoActual?.metodo || 'Pendiente');

      const detalleAjuste = Number(ajuste?.monto || 0) > 0
        ? `${ajuste.tipo || 'ajuste'}: -${fMon(ajuste.monto)} (${ajuste.motivo || 'sin detalle'})`
        : '';
      const detalleNoRealizados = serviciosNoRealizados.length
        ? `No realizados: ${serviciosNoRealizados.map((servicio) => servicio.nombre).join(', ')}`
        : '';
      const notasFinCompletas = [
        notasFin,
        detalleAjuste ? `Ajuste financiero: ${detalleAjuste}` : '',
        detalleNoRealizados
      ].filter(Boolean).join('\n');

      const serviciosLimpios = serviciosRealizados.map((servicio) => ({
        servicioId: servicio.servicioId || null,
        nombre: servicio.nombre,
        costo: Number(servicio.costo || 0),
        origen: servicio.origen || 'realizado'
      }));
      const planVinculado = pagoActual
        ? planPagos.find((plan) => Number(plan.pagoId) === Number(pagoActual.id))
        : null;

      await api.actualizarCita(citaId, {
        ...citaActual,
        procedimiento: procedimiento || serviciosLimpios.map((servicio) => servicio.nombre).join(' + '),
        servicios: serviciosLimpios,
        costo: total,
        tipoPago: tipoPagoFinal,
        estado: 'completada',
        notasFin: notasFinCompletas,
        fin: new Date().toISOString()
      });

      const notaPago = [
        `Subtotal realizado: ${fMon(subtotal)}`,
        detalleAjuste ? `Ajuste: ${detalleAjuste}` : '',
        cobroRegistrado > 0 ? `Cobrado al cierre: ${fMon(cobroRegistrado)} por ${metodoCompleto}` : '',
        creditoFavor > 0 ? `Crédito a favor: ${fMon(creditoFavor)}` : '',
        accionSaldo === 'agregar_plan' ? 'Saldo asignado a plan de pagos' : ''
      ].filter(Boolean).join(' | ');

      const datosPago = {
        ...(pagoActual || {}),
        pacienteId,
        citaId,
        concepto: procedimiento || citaActual.procedimiento || 'Atención dental',
        fecha: pagoActual?.fecha || citaActual.fecha || obtenerFechaLocal(),
        total,
        cobrado: nuevoCobrado,
        saldo: nuevoSaldo,
        metodo: metodoRegistro,
        tipoPago: tipoPagoFinal,
        servicios: serviciosLimpios,
        cuotas: pagoActual?.cuotas || [],
        creadoEn: pagoActual?.creadoEn || new Date().toISOString(),
        fechaUltPago: cobroRegistrado > 0 ? obtenerFechaLocal() : (pagoActual?.fechaUltPago || null),
        nota: [pagoActual?.nota, notaPago].filter(Boolean).join(' | '),
        devuelto: Number(pagoActual?.devuelto || 0),
        creditoFavor
      };

      let pagoGuardado = pagoActual;
      if (pagoActual) {
        const respuestaPago = await api.actualizarPago(pagoActual.id, datosPago);
        pagoGuardado = respuestaPago?.registro || pagoActual;
      } else if (!citaActual.planId || total > 0) {
        pagoGuardado = await api.crearPago(datosPago);
      }

      if (cobroRegistrado > 0) {
        if (planVinculado) {
          await api.registrarAdelantoPlanPago(planVinculado.id, {
            monto: cobroRegistrado,
            metodo: metodoCompleto,
            referencia: '',
            motivo: 'Adelanto registrado al finalizar la atención',
            usuario: usuarioActual?.nombre || 'Administrador'
          });
        } else {
          await api.crearMovimientoCuenta({
            pacienteId,
            citaId,
            pagoId: pagoGuardado?.id || pagoActual?.id || null,
            tipo: 'pago',
            descripcion: `Pago al cierre: ${procedimiento || citaActual.procedimiento || 'Atencion dental'}`,
            cargo: 0,
            abono: cobroRegistrado,
            fecha: obtenerFechaLocal(),
            metodo: metodoCompleto,
            referencia: '',
            motivo: 'Cobro registrado al finalizar la atencion',
            usuario: 'Administrador',
            creadoEn: new Date().toISOString()
          });
        }
      }

      setModalCompletarAbierto(false);
      setCitaParaAccion(null);
      setPagoParaAccion(null);

      await Promise.all([cargarCitas(), cargarPagos(), cargarPlanPagos(), cargarPlanes()]);

      if (accionSaldo === 'agregar_plan' && nuevoSaldo > 0 && !planVinculado) {
        const paciente = pacientes.find((item) => Number(item.id) === Number(pacienteId));
        const deudaCreada = pagoGuardado || pagoActual;
        if (!deudaCreada?.id) {
          throw new Error('La atención terminó, pero no se pudo identificar la deuda que debe financiarse.');
        }
        setPlanPagoContexto({
          pacienteId,
          pagoId: deudaCreada.id,
          citaId,
          casoClinicoId: citaActual.casoClinicoId || null,
          concepto: procedimiento || citaActual.procedimiento || 'Atención dental',
          totalAcordado: total,
          cobrado: nuevoCobrado,
          origen: 'procedimiento',
          nombrePaciente: paciente?.nombre || 'Paciente'
        });
        setModalPPAbierto(true);
        return;
      }

      Swal.fire({
        title: 'Atención finalizada',
        text: nuevoSaldo > 0
          ? `Queda un saldo pendiente de ${fMon(nuevoSaldo)}.`
          : creditoFavor > 0
            ? `Pago completo. Crédito a favor: ${fMon(creditoFavor)}.`
            : 'Los servicios y el pago quedaron actualizados.',
        icon: 'success',
        background: '#1e293b',
        color: '#fff',
        timer: 2400,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        title: 'No se pudo finalizar la atención',
        text: error.message || 'Ocurrió un error al actualizar los servicios y el pago.',
        icon: 'error',
        background: '#1e293b',
        color: '#fff'
      });
    }
  };


  const handleGuardarCancelacion = async ({ citaId, pagoId, motivoCancelacion, opcionDevolucion, montoCobrado }) => {
    try {
      const citaActual = citas.find((cita) => Number(cita.id) === Number(citaId));
      if (!citaActual) throw new Error('No se encontro la cita que se desea cancelar.');
      if (!String(motivoCancelacion || '').trim()) throw new Error('El motivo de la cancelacion es obligatorio.');

      const pagoActual = pagoId ? pagos.find((pago) => Number(pago.id) === Number(pagoId)) : null;
      const cobrado = Math.max(0, Number(montoCobrado || pagoActual?.cobrado || 0));
      const motivo = `Cancelacion de cita: ${motivoCancelacion}`;

      if (pagoActual) {
        if (opcionDevolucion === 'total_dev' && cobrado > 0) {
          await api.devolverPago(pagoActual.id, {
            monto: cobrado,
            metodo: pagoActual.metodo || 'Pago original',
            motivo,
            usuario: 'Administrador'
          });
          await api.actualizarPago(pagoActual.id, {
            ...pagoActual,
            total: 0,
            cobrado: 0,
            saldo: 0,
            devuelto: Number(pagoActual.devuelto || 0) + cobrado,
            tipoPago: 'cancelado_devuelto',
            nota: [pagoActual.nota, motivo, `Devolucion: ${fMon(cobrado)}`].filter(Boolean).join(' | ')
          });
        } else if (opcionDevolucion === 'credito' && cobrado > 0) {
          await api.actualizarPago(pagoActual.id, {
            ...pagoActual,
            total: 0,
            cobrado,
            saldo: 0,
            creditoFavor: Number(pagoActual.creditoFavor || 0) + cobrado,
            tipoPago: 'cancelado_credito',
            nota: [pagoActual.nota, motivo, `Credito a favor: ${fMon(cobrado)}`].filter(Boolean).join(' | ')
          });
          await api.crearMovimientoCuenta({
            pacienteId: pagoActual.pacienteId,
            citaId,
            pagoId: pagoActual.id,
            tipo: 'credito_favor',
            descripcion: `Credito a favor por cancelacion: ${pagoActual.concepto || 'Atencion dental'}`,
            cargo: 0,
            abono: 0,
            fecha: obtenerFechaLocal(),
            metodo: pagoActual.metodo || 'Pago original',
            motivo,
            usuario: 'Administrador',
            creadoEn: new Date().toISOString()
          });
        } else if (opcionDevolucion === 'retener' && cobrado > 0) {
          await api.actualizarPago(pagoActual.id, {
            ...pagoActual,
            total: cobrado,
            cobrado,
            saldo: 0,
            tipoPago: 'cancelado_retenido',
            concepto: `Cargo por cancelacion: ${pagoActual.concepto || citaActual.procedimiento || 'Atencion dental'}`,
            nota: [pagoActual.nota, motivo, `Importe retenido: ${fMon(cobrado)}`].filter(Boolean).join(' | ')
          });
        } else {
          await api.actualizarPago(pagoActual.id, {
            ...pagoActual,
            total: 0,
            cobrado: 0,
            saldo: 0,
            tipoPago: 'cancelado_sin_cobro',
            nota: [pagoActual.nota, motivo].filter(Boolean).join(' | ')
          });
        }

        await api.crearMovimientoCuenta({
          pacienteId: pagoActual.pacienteId,
          citaId,
          pagoId: pagoActual.id,
          tipo: 'cancelacion_cita',
          descripcion: `Cita cancelada: ${pagoActual.concepto || citaActual.procedimiento || 'Atencion dental'}`,
          cargo: 0,
          abono: 0,
          fecha: obtenerFechaLocal(),
          metodo: opcionDevolucion,
          motivo,
          usuario: 'Administrador',
          creadoEn: new Date().toISOString()
        });
      }

      await api.actualizarCita(citaId, {
        ...citaActual,
        estado: 'cancelada',
        motivoCancelacion,
        canceladaEn: new Date().toISOString()
      });

      setModalCancelarAbierto(false);
      setCitaParaAccion(null);
      setPagoParaAccion(null);
      await Promise.all([cargarCitas(), cargarPagos(), cargarPlanPagos(), cargarPlanes()]);
      Swal.fire({ title: 'Cita cancelada', text: 'La decision clinica y el movimiento financiero quedaron registrados.', icon: 'success', background: '#1e293b', color: '#fff', timer: 2200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo cancelar', text: error.message || 'Ocurrio un error al procesar la cancelacion.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  return {
    handleGuardarCompletado,
    handleGuardarCancelacion
  };
};
