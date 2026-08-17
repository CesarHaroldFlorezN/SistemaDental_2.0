import Swal from 'sweetalert2';
import { api } from '../../services/api';
import { obtenerFechaLocal } from '../../shared/utils/dentalPro';

export const crearAccionesPlanesPago = ({
  usuarioActual,
  cargarPlanPagos,
  cargarPagos,
  cargarPlanes,
  cargarMovimientosCuenta,
  fMon,
  setModalPPAbierto,
  setPlanPagoContexto
}) => {
  const reajustarCuotas = (plan) => {
    const pendientes = plan.cuotas.filter(q => !q.pagado && q.tipo !== 'anticipo');
    if (pendientes.length === 0) return;
    const pagado = plan.cuotas.filter(q => q.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
    const anticipo = Number(plan.anticipo || 0);
    const restante = Math.max(0, Number(plan.totalAcordado || 0) - anticipo - pagado);
    const centavos = Math.round(restante * 100);
    const base = Math.floor(centavos / pendientes.length);
    const sobrante = centavos - (base * pendientes.length);
    pendientes.forEach((cuota, indice) => {
      cuota.monto = (base + (indice < sobrante ? 1 : 0)) / 100;
    });
    plan.totalCuotas = plan.cuotas.reduce((a, q) => a + Number(q.monto || 0), 0);
    plan.cobrado = anticipo + pagado;
    plan.saldo = Math.max(0, Number(plan.totalAcordado || 0) - plan.cobrado);
  };

  const handlePagarCuota = async (plan, idx) => {
    const cuota = plan.cuotas[idx];
    if (!cuota || cuota.pagado) return;
    const etiquetaSesion = plan.origen === 'plan_tratamiento'
      ? `Cuota ${cuota.num} vinculada a la sesión ${cuota.sesionNum || cuota.num}`
      : `Cuota ${cuota.num}`;
    const resultado = await Swal.fire({
      title: `Registrar ${etiquetaSesion.toLowerCase()}`,
      html: `<div style="text-align:left;display:grid;gap:12px"><div>${etiquetaSesion}</div><div>Monto: <strong>${fMon(cuota.monto)}</strong></div><select id="dp-metodo-cuota" class="swal2-select" style="margin:0;width:100%"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select><input id="dp-ref-cuota" class="swal2-input" placeholder="Referencia u operación (opcional)" style="margin:0;width:100%"></div>`,
      showCancelButton: true,
      confirmButtonText: plan.origen === 'plan_tratamiento' ? `Pagar cuota ${cuota.num}` : 'Registrar pago',
      cancelButtonText: 'Cancelar',
      background: '#1e293b',
      color: '#fff',
      preConfirm: () => ({ metodo: document.getElementById('dp-metodo-cuota')?.value || 'Efectivo', referencia: document.getElementById('dp-ref-cuota')?.value || '' })
    });
    if (!resultado.isConfirmed) return;
    const cuotasActualizadas = plan.cuotas.map((item, indice) => indice === idx ? {
      ...item,
      pagado: true,
      fechaPago: obtenerFechaLocal(),
      metodoPago: resultado.value.metodo,
      referencia: resultado.value.referencia
    } : { ...item });
    try {
      await api.actualizarPlanPago(plan.id, { ...plan, cuotas: cuotasActualizadas });
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      Swal.fire({ title: `Cuota ${cuota.num} pagada`, text: plan.origen === 'plan_tratamiento' ? `Quedó vinculada a la sesión ${cuota.sesionNum || cuota.num}.` : undefined, icon: 'success', background: '#1e293b', color: '#fff', timer: 1700, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo pagar la cuota', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleRegistrarAdelantoPlan = async (plan) => {
    const saldo = Number(plan.saldo || 0);
    if (saldo <= 0) return;
    const resultado = await Swal.fire({
      title: 'Registrar adelanto',
      html: `<div style="text-align:left;display:grid;gap:12px"><div>Saldo actual: <strong>${fMon(saldo)}</strong></div><div style="font-size:12px;color:#cbd5e1">El adelanto reduce directamente la deuda y recalcula solo las cuotas pendientes, sin alterar las ya pagadas.</div><input id="dp-monto-adelanto" type="number" data-money-input="true" min="0.01" max="${saldo}" step="0.01" class="swal2-input" placeholder="Monto del adelanto" style="margin:0;width:100%"><select id="dp-metodo-adelanto" class="swal2-select" style="margin:0;width:100%"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select><input id="dp-ref-adelanto" class="swal2-input" placeholder="Referencia u operación (opcional)" style="margin:0;width:100%"></div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar adelanto',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      background: '#1e293b',
      color: '#fff',
      preConfirm: () => {
        const monto = Number(document.getElementById('dp-monto-adelanto')?.value || 0);
        if (monto <= 0 || monto > saldo) return Swal.showValidationMessage('Ingresa un monto válido que no supere el saldo.');
        return {
          monto,
          metodo: document.getElementById('dp-metodo-adelanto')?.value || 'Efectivo',
          referencia: document.getElementById('dp-ref-adelanto')?.value || '',
          motivo: 'Adelanto voluntario del paciente',
          usuario: usuarioActual?.nombre || 'Administrador'
        };
      }
    });
    if (!resultado.isConfirmed) return;
    try {
      const respuesta = await api.registrarAdelantoPlanPago(plan.id, resultado.value);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      const saldoNuevo = Number(respuesta?.registro?.saldo ?? saldo - resultado.value.monto);
      Swal.fire({ title: 'Adelanto registrado', text: `${fMon(resultado.value.monto)} aplicado. Saldo: ${fMon(saldo)} → ${fMon(saldoNuevo)}.`, icon: 'success', background: '#1e293b', color: '#fff', timer: 2600, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo registrar el adelanto', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleRevertirCuota = async (plan, idx) => {
    const confirm = await Swal.fire({ title: '¿Revertir este pago?', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#d97706', confirmButtonText: 'Sí, revertir' });
    if (confirm.isConfirmed) {
      const cuotasActualizadas = plan.cuotas.map((cuota, posicion) => posicion === idx
        ? { ...cuota, pagado: false, fechaPago: null, metodoPago: null, referencia: '' }
        : { ...cuota });
      await api.actualizarPlanPago(plan.id, {
        ...plan,
        estado: 'activo',
        cuotas: cuotasActualizadas
      });
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      Swal.fire({ title: 'Cobro revertido', icon: 'warning', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleAgregarCuota = async (plan) => {
    const ultima = plan.cuotas[plan.cuotas.length - 1];
    const nFec = ultima && ultima.fecha ? new Date(new Date(`${ultima.fecha}T12:00:00`).setDate(new Date(`${ultima.fecha}T12:00:00`).getDate() + 30)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    plan.cuotas.push({ num: 0, tipo: 'cuota', fecha: nFec, monto: 0, pagado: false, fechaPago: null, metodoPago: null });
    let cont = 1; plan.cuotas.forEach(q => { if (q.tipo !== 'anticipo') q.num = cont++; });
    reajustarCuotas(plan);
    await api.actualizarPlanPago(plan.id, plan);
    await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
    Swal.fire({ title: 'Cuota añadida', icon: 'success', background: '#1e293b', color: '#fff', timer: 1600, showConfirmButton: false });
  };

  const handleQuitarCuota = async (plan, idx) => {
    const confirm = await Swal.fire({ title: '¿Eliminar esta cuota pendiente?', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar' });
    if (confirm.isConfirmed) {
      plan.cuotas.splice(idx, 1);
      let cont = 1; plan.cuotas.forEach(q => { if (q.tipo !== 'anticipo') q.num = cont++; });
      reajustarCuotas(plan);
      await api.actualizarPlanPago(plan.id, plan);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      Swal.fire({ title: 'Cuota eliminada', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleEliminarPlan = async (id) => {
    const confirm = await Swal.fire({ title: '¿Eliminar plan de pago?', text: 'Se quitará el cronograma, pero la deuda y todos los cobros registrados se conservarán.', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#e11d48', confirmButtonText: 'Sí, eliminar plan', cancelButtonText: 'Cancelar' });
    if (!confirm.isConfirmed) return;
    try {
      await api.eliminarPlanPago(id);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      Swal.fire({ title: 'Plan eliminado', text: 'La deuda y sus cobros se conservaron.', icon: 'success', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo eliminar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleGuardarNuevoPP = async (payload, id = null) => {
    try {
      if (id) await api.actualizarPlanPago(id, payload);
      else await api.crearPlanPago(payload);
      setModalPPAbierto(false);
      setPlanPagoContexto(null);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      Swal.fire({ title: id ? 'Plan de pagos actualizado' : 'Plan de pagos vinculado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1600, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: id ? 'No se pudo actualizar' : 'No se pudo crear', text: error.message || 'No se pudo guardar el plan de pago.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  return {
    handlePagarCuota,
    handleRegistrarAdelantoPlan,
    handleRevertirCuota,
    handleAgregarCuota,
    handleQuitarCuota,
    handleEliminarPlan,
    handleGuardarNuevoPP
  };
};
