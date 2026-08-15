import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { api } from '../../services/api';
import { crearAccionesCierreCitas } from './cierreCitas';

export const crearAccionesCitas = ({
  usuarioActual,
  pacientes,
  citas,
  pagos,
  planPagos,
  cargarCitas,
  cargarPagos,
  cargarPlanPagos,
  cargarPlanes,
  cargarCasosClinicos,
  fMon,
  setVistaActiva,
  setBusquedaPP,
  setCitaSeleccionada,
  setModalCitaAbierto,
  setPlanPagoContexto,
  setModalPPAbierto,
  setCitaParaAccion,
  setPagoParaAccion,
  setModalCompletarAbierto,
  setModalCancelarAbierto
}) => {
  const handleNuevaCita = (datosIniciales = null) => {
    const esEventoReact = Boolean(datosIniciales?.nativeEvent);
    const datosValidos =
      datosIniciales && typeof datosIniciales === 'object' && !esEventoReact
        ? datosIniciales
        : null;

    setCitaSeleccionada(datosValidos);
    setModalCitaAbierto(true);
  };
  const handleEditarCita = (cita) => { setCitaSeleccionada(cita); setModalCitaAbierto(true); };

  const handleGuardarCita = async (payload, id, opciones = {}) => {
    try {
      let respuesta;
      if (id) {
        respuesta = await api.actualizarCitaConPago(id, payload);
        Swal.fire({
          title: 'Cita actualizada',
          text: 'La cita y su información financiera se actualizaron correctamente.',
          icon: 'success',
          background: '#1e293b',
          color: '#fff',
          timer: 1700,
          showConfirmButton: false
        });
      } else {
        respuesta = await api.crearCitaConPago(payload);
        Swal.fire({
          title: 'Cita agendada',
          text: 'La cita y su registro financiero fueron creados correctamente.',
          icon: 'success',
          background: '#1e293b',
          color: '#fff',
          timer: 1700,
          showConfirmButton: false
        });
      }

      setModalCitaAbierto(false);
      setCitaSeleccionada(null);

      await Promise.all([
        cargarCitas(),
        cargarPagos(),
        cargarPlanPagos(),
        cargarPlanes(),
        cargarCasosClinicos()
      ]);

      if (opciones.abrirPlanPagos && respuesta?.pago && !respuesta?.planPago) {
        setPlanPagoContexto({
          pacienteId: respuesta.cita?.pacienteId,
          pagoId: respuesta.pago.id,
          citaId: respuesta.cita?.id,
          casoClinicoId: respuesta.casoClinico?.id,
          concepto: respuesta.pago.concepto,
          totalAcordado: respuesta.pago.total,
          cobrado: respuesta.pago.cobrado,
          origen: 'procedimiento'
        });
        setModalPPAbierto(true);
      }
    } catch (error) {
      Swal.fire({
        title: 'No se pudo guardar',
        text: error.message || 'Ocurrió un error desconocido al guardar la cita.',
        icon: 'error',
        background: '#1e293b',
        color: '#fff'
      });
    }
  };

  const handleEliminarCita = async (id, nombrePaciente) => {
    const confirm = await Swal.fire({
      title: `¿Eliminar cita de ${nombrePaciente}?`,
      text: 'También se eliminará su registro financiero si todavía no tiene dinero cobrado.',
      icon: 'warning',
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.eliminarCitaConPago(id);

      await Promise.all([
        cargarCitas(),
        cargarPagos(),
        cargarPlanPagos()
      ]);

      Swal.fire({
        title: 'Cita eliminada',
        icon: 'success',
        background: '#1e293b',
        color: '#fff',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        title: 'No se pudo eliminar',
        text: error.message || 'La cita tiene información financiera relacionada.',
        icon: 'error',
        background: '#1e293b',
        color: '#fff'
      });
    }
  };

  const handleCambiarEstadoCita = async (cita, nuevoEstado) => {
    const nombresEstado = {
      confirmada: 'confirmada',
      en_espera: 'en espera',
      en_atencion: 'en atención',
      no_asistio: 'no asistió'
    };

    if (nuevoEstado === 'no_asistio') {
      const confirmacion = await Swal.fire({
        title: '¿Registrar que no asistió?',
        text: `La cita de ${cita.nombrePaciente || 'este paciente'} quedará cerrada como inasistencia.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, registrar',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#ea580c',
        background: '#1e293b',
        color: '#fff'
      });

      if (!confirmacion.isConfirmed) return;
    }

    try {
      const respuesta = await api.cambiarEstadoCita(cita.id, nuevoEstado);
      await cargarCitas();

      Swal.fire({
        title: nuevoEstado === 'en_atencion' ? 'Atención iniciada' : 'Estado actualizado',
        text: respuesta?.message || `La cita ahora está ${nombresEstado[nuevoEstado] || nuevoEstado}.`,
        icon: nuevoEstado === 'en_atencion' ? 'info' : 'success',
        background: '#1e293b',
        color: '#fff',
        timer: 1600,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        title: 'No se pudo cambiar el estado',
        text: error.message || 'Ocurrió un error al actualizar la cita.',
        icon: 'error',
        background: '#1e293b',
        color: '#fff'
      });
    }
  };

  const handleReprogramarCita = async (cita, nuevaFechaHora, nuevaHoraFinDate = null) => {
    const nuevaFecha = format(nuevaFechaHora, 'yyyy-MM-dd');
    const nuevaHora = format(nuevaFechaHora, 'HH:mm');
    const duracionAnterior = Number(cita.duracionMinutos || 60);
    const finDestino = nuevaHoraFinDate instanceof Date
      ? nuevaHoraFinDate
      : new Date(nuevaFechaHora.getTime() + duracionAnterior * 60 * 1000);
    const nuevaHoraFin = format(finDestino, 'HH:mm');
    const duracionNueva = Math.max(5, Math.round((finDestino.getTime() - nuevaFechaHora.getTime()) / 60000));

    if (cita.fecha === nuevaFecha && cita.hora === nuevaHora && (cita.horaFin || '') === nuevaHoraFin) return;

    const anterior = {
      fecha: cita.fecha,
      hora: cita.hora,
      horaFin: cita.horaFin || (() => {
        const inicio = new Date(`${cita.fecha}T${cita.hora}:00`);
        return format(new Date(inicio.getTime() + duracionAnterior * 60000), 'HH:mm');
      })(),
      duracionMinutos: duracionAnterior
    };

    try {
      await api.reprogramarCita(cita.id, {
        fecha: nuevaFecha,
        hora: nuevaHora,
        horaFin: nuevaHoraFin,
        duracionMinutos: duracionNueva
      });
      await cargarCitas();

      const resultado = await Swal.fire({
        toast: true,
        position: 'top-end',
        title: nuevaHora === cita.hora && nuevaFecha === cita.fecha ? 'Duracion actualizada' : 'Cita reprogramada',
        text: `${nuevaFecha} · ${nuevaHora} a ${nuevaHoraFin}`,
        icon: 'success',
        showConfirmButton: true,
        confirmButtonText: 'Deshacer',
        timer: 5000,
        timerProgressBar: true,
        background: '#1e293b',
        color: '#fff'
      });

      if (resultado.isConfirmed) {
        await api.reprogramarCita(cita.id, anterior);
        await cargarCitas();
        Swal.fire({ toast: true, position: 'top-end', title: 'Cambio deshecho', icon: 'info', timer: 1600, showConfirmButton: false, background: '#1e293b', color: '#fff' });
      }
    } catch (error) {
      await cargarCitas();
      Swal.fire({ title: 'No se pudo cambiar el horario', text: error.message || 'El horario seleccionado no está disponible.', icon: 'error', background: '#1e293b', color: '#fff' });
      throw error;
    }
  };

  const handleVerCuotasDesdeAgenda = (cita) => {
    setBusquedaPP(cita?.nombrePaciente || '');
    setVistaActiva('planpagos');
  };

  const handleAbrirCompletar = (cita) => {
    const pagoAsociado = pagos.find(p => Number(p.citaId) === Number(cita.id));
    setCitaParaAccion(cita);
    setPagoParaAccion(pagoAsociado || null);
    setModalCompletarAbierto(true);
  };

  const handleAbrirCancelar = (cita) => {
    const pagoAsociado = pagos.find(p => Number(p.citaId) === Number(cita.id));
    setCitaParaAccion(cita);
    setPagoParaAccion(pagoAsociado || null);
    setModalCancelarAbierto(true);
  };

  // DENTALPRO_V7_CIERRE: cierre clínico y financiero por servicios reales.
  const {
    handleGuardarCompletado,
    handleGuardarCancelacion
  } = crearAccionesCierreCitas({
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
  });

  const handleCobrarSaldo = async (pago, nombrePaciente) => {
    const saldoActual = Number(pago?.saldo || 0);
    if (saldoActual <= 0) {
      Swal.fire({ title: 'Pago completo', text: 'Este tratamiento ya no tiene saldo pendiente.', icon: 'success', background: '#1e293b', color: '#fff' });
      return;
    }

    const planVinculado = planPagos.find((plan) => Number(plan.pagoId) === Number(pago.id));
    if ((pago.tipoPago || '').toLowerCase() === 'cuotas' && planVinculado) {
      setBusquedaPP(nombrePaciente || '');
      setVistaActiva('planpagos');
      return;
    }

    const resultado = await Swal.fire({
      title: `Registrar pago de ${nombrePaciente}`,
      html: `<div style="text-align:left;display:grid;gap:12px"><div>Saldo pendiente: <strong>${fMon(saldoActual)}</strong></div><input id="dp-monto-cobro" type="number" data-money-input="true" min="0.01" max="${saldoActual}" step="0.01" value="${saldoActual}" class="swal2-input" style="margin:0;width:100%"><select id="dp-metodo-cobro" class="swal2-select" style="margin:0;width:100%"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select><input id="dp-ref-cobro" class="swal2-input" placeholder="Referencia u operacion (opcional)" style="margin:0;width:100%"></div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar pago',
      cancelButtonText: 'Cancelar',
      background: '#1e293b',
      color: '#fff',
      preConfirm: () => {
        const monto = Number(document.getElementById('dp-monto-cobro')?.value || 0);
        if (monto <= 0 || monto > saldoActual) return Swal.showValidationMessage('El monto no es valido.');
        return { monto, metodo: document.getElementById('dp-metodo-cobro')?.value || 'Efectivo', referencia: document.getElementById('dp-ref-cobro')?.value || '', usuario: 'Administrador' };
      }
    });
    if (!resultado.isConfirmed) return;
    try {
      await api.registrarPago(pago.id, resultado.value);
      await Promise.all([cargarPagos(), cargarPlanPagos(), cargarPlanes()]);
      Swal.fire({ title: 'Pago registrado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo registrar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  return {
    handleNuevaCita,
    handleEditarCita,
    handleGuardarCita,
    handleEliminarCita,
    handleCambiarEstadoCita,
    handleReprogramarCita,
    handleVerCuotasDesdeAgenda,
    handleAbrirCompletar,
    handleAbrirCancelar,
    handleGuardarCompletado,
    handleGuardarCancelacion,
    handleCobrarSaldo
  };
};
