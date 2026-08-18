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
    const pendientesPuras = plan.cuotas.filter(q => !q.pagado && !q.pagadoParcial && q.tipo !== 'anticipo');
    const pagadoCompleto = plan.cuotas.filter(q => q.pagado).reduce((a, c) => a + Number(c.monto || 0), 0);
    const pagadoParcial = plan.cuotas.filter(q => q.pagadoParcial).reduce((a, c) => a + Number(c.montoPagado || 0), 0);
    
    const anticipo = Number(plan.anticipo || 0);
    const cobradoTotal = anticipo + pagadoCompleto + pagadoParcial;
    
    // El monto atrapado en las cuotas parciales (c.monto ES el remanente)
    const saldoParciales = plan.cuotas.filter(q => q.pagadoParcial).reduce((a, c) => a + Number(c.monto || 0), 0);
    
    const restante = Math.max(0, Number(plan.totalAcordado || 0) - cobradoTotal - saldoParciales);
    
    if (pendientesPuras.length > 0) {
      const centavos = Math.round(restante * 100);
      const base = Math.floor(centavos / pendientesPuras.length);
      const sobrante = centavos - (base * pendientesPuras.length);
      pendientesPuras.forEach((cuota, indice) => {
        cuota.monto = (base + (indice < sobrante ? 1 : 0)) / 100;
      });
    }
    
    plan.totalCuotas = plan.cuotas.reduce((a, q) => a + Number(q.monto || 0) + Number(q.montoPagado || 0), 0);
    plan.cobrado = cobradoTotal;
    plan.saldo = Math.max(0, Number(plan.totalAcordado || 0) - plan.cobrado);
  };

  const handlePagarCuota = async (plan, idx) => {
    const cuota = plan.cuotas[idx];
    if (!cuota || cuota.pagado) return;
    
    const montoPendiente = Number(cuota.monto || 0);
    const yaPagado = Number(cuota.montoPagado || 0);
    const saldoMaximo = Number(plan.saldo || 0) + montoPendiente; 
    
    const etiquetaSesion = plan.origen === 'plan_tratamiento'
      ? `Cuota ${cuota.num} vinculada a la sesión ${cuota.sesionNum || cuota.num}`
      : `Cuota ${cuota.num}`;
      
    const resultado = await Swal.fire({
      title: cuota.pagadoParcial ? `Completar Cuota` : `Registrar pago`,
      html: `<div style="text-align:left;display:grid;gap:12px">
        <div style="font-weight:bold;color:#22d3ee">${etiquetaSesion}</div>
        <div style="font-size:12px;color:#cbd5e1">Ingresa el monto a pagar. Si pagas menos de ${fMon(montoPendiente)}, quedará como pago parcial.</div>
        <div>
          <label style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:bold">Monto a pagar (S/.)</label>
          <input id="dp-monto-cuota" type="number" min="0.10" max="${saldoMaximo}" step="0.01" value="${montoPendiente}" class="swal2-input" style="margin:0;width:100%;font-weight:bold;color:#34d399">
        </div>
        <select id="dp-metodo-cuota" class="swal2-select" style="margin:0;width:100%">
          <option>Efectivo</option>
          <option>Yape</option>
          <option>Plin</option>
          <option>Transferencia</option>
          <option>Tarjeta</option>
        </select>
        <input id="dp-ref-cuota" class="swal2-input" placeholder="Referencia u operación (opcional)" style="margin:0;width:100%">
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar pago',
      cancelButtonText: 'Cancelar',
      background: '#1e293b',
      color: '#fff',
      preConfirm: () => {
        const montoIngresado = Number(document.getElementById('dp-monto-cuota')?.value || 0);
        if (montoIngresado <= 0) return Swal.showValidationMessage(`El monto debe ser mayor a 0.`);
        if (montoIngresado > saldoMaximo) return Swal.showValidationMessage(`El monto no puede superar la deuda total.`);
        return { 
          monto: montoIngresado,
          metodo: document.getElementById('dp-metodo-cuota')?.value || 'Efectivo', 
          referencia: document.getElementById('dp-ref-cuota')?.value || '' 
        };
      }
    });
    
    if (!resultado.isConfirmed) return;
    
    const montoIngresado = resultado.value.monto;
    const nuevoMontoPagado = yaPagado + montoIngresado;
    const esPagoCompleto = montoIngresado >= montoPendiente;
    
    const cuotasActualizadas = plan.cuotas.map((item, indice) => {
      if (indice !== idx) return { ...item };
      
      if (esPagoCompleto) {
        const montoExtra = montoIngresado - montoPendiente;
        return {
          ...item,
          monto: yaPagado + montoPendiente + montoExtra, // Restaura la cuota a su tamaño original histórico
          pagado: true,
          pagadoParcial: false,
          montoPagado: null,
          fechaPago: obtenerFechaLocal(),
          metodoPago: resultado.value.metodo,
          referencia: resultado.value.referencia
        };
      } else {
        return {
          ...item,
          monto: montoPendiente - montoIngresado, // El UI leerá el saldo remanente automáticamente
          pagado: false,
          pagadoParcial: true,
          montoPagado: nuevoMontoPagado,
          fechaPago: null,
          metodoPago: resultado.value.metodo,
          referencia: resultado.value.referencia
        };
      }
    });
    
    const planActualizado = { ...plan, cuotas: cuotasActualizadas };
    
    // Recalcula todo si hubo un pago parcial (para cuadrar caja) o una amortización (para restar a las demás)
    if (!esPagoCompleto || montoIngresado > montoPendiente) {
      reajustarCuotas(planActualizado);
    }
    
    try {
      await api.actualizarPlanPago(plan.id, planActualizado);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      
      const extraPago = montoIngresado - montoPendiente;
      let msg = `Pago registrado.`;
      if (!esPagoCompleto) msg = `Pago parcial guardado. Falta ${fMon(montoPendiente - montoIngresado)} de la cuota.`;
      if (extraPago > 0) msg = `Cuota pagada y se amortizaron ${fMon(extraPago)} al saldo.`;
        
      Swal.fire({ title: esPagoCompleto ? `Cuota completada` : `Pago Parcial`, text: msg, icon: 'success', background: '#1e293b', color: '#fff', timer: 2500, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo pagar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleRegistrarAdelantoPlan = async (plan) => {
    const saldo = Number(plan.saldo || 0);
    if (saldo <= 0) return;
    const resultado = await Swal.fire({
      title: 'Registrar adelanto',
      html: `<div style="text-align:left;display:grid;gap:12px"><div>Saldo actual: <strong>${fMon(saldo)}</strong></div><input id="dp-monto-adelanto" type="number" data-money-input="true" min="0.01" max="${saldo}" step="0.01" class="swal2-input" placeholder="Monto del adelanto" style="margin:0;width:100%"><select id="dp-metodo-adelanto" class="swal2-select" style="margin:0;width:100%"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select><input id="dp-ref-adelanto" class="swal2-input" placeholder="Referencia u operación (opcional)" style="margin:0;width:100%"></div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar adelanto',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      background: '#1e293b',
      color: '#fff',
      preConfirm: () => {
        const monto = Number(document.getElementById('dp-monto-adelanto')?.value || 0);
        if (monto <= 0 || monto > saldo) return Swal.showValidationMessage('Monto no válido.');
        return { monto, metodo: document.getElementById('dp-metodo-adelanto')?.value || 'Efectivo', referencia: document.getElementById('dp-ref-adelanto')?.value || '', motivo: 'Adelanto voluntario', usuario: usuarioActual?.nombre || 'Administrador' };
      }
    });
    if (!resultado.isConfirmed) return;
    try {
      await api.registrarAdelantoPlanPago(plan.id, resultado.value);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      Swal.fire({ title: 'Adelanto registrado', icon: 'success', background: '#1e293b', color: '#fff', timer: 2000, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'Error', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleRevertirUltimoAdelanto = async (plan) => {
    const confirm = await Swal.fire({ 
        title: '¿Revertir último adelanto?', 
        text: 'Se descontará el último adelanto y se recalcularán las cuotas.',
        icon: 'warning', 
        showCancelButton: true, 
        background: '#1e293b', 
        color: '#fff', 
        confirmButtonColor: '#ef4444', 
        confirmButtonText: 'Sí, revertir' 
    });
    if (confirm.isConfirmed) {
      try {
          await api.revertirUltimoAdelantoPlanPago(plan.id);
          await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
          Swal.fire({ title: 'Adelanto revertido', icon: 'success', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
      } catch (error) {
          Swal.fire({ title: 'Error al revertir', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
      }
    }
  };

  const handleRevertirCuota = async (plan, idx) => {
    const confirm = await Swal.fire({ title: '¿Revertir este pago?', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#d97706', confirmButtonText: 'Sí, revertir' });
    if (confirm.isConfirmed) {
      const cuotasActualizadas = plan.cuotas.map((cuota, posicion) => {
        if (posicion !== idx) return { ...cuota };
        return {
          ...cuota, 
          monto: Number(cuota.monto || 0) + Number(cuota.montoPagado || 0), // Restaura su tamaño real histórico
          pagado: false, pagadoParcial: false, montoPagado: null, fechaPago: null, metodoPago: null, referencia: '' 
        };
      });
      const planA = { ...plan, estado: 'activo', cuotas: cuotasActualizadas };
      reajustarCuotas(planA);
      await api.actualizarPlanPago(plan.id, planA);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
      Swal.fire({ title: 'Cobro revertido', icon: 'warning', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleAgregarCuota = async (plan) => {
    const ultima = plan.cuotas[plan.cuotas.length - 1];
    const nFec = ultima && ultima.fecha ? new Date(new Date(`${ultima.fecha}T12:00:00`).setDate(new Date(`${ultima.fecha}T12:00:00`).getDate() + 30)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    plan.cuotas.push({ num: 0, tipo: 'cuota', fecha: nFec, monto: 0, pagado: false, pagadoParcial: false, montoPagado: null, fechaPago: null, metodoPago: null });
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
    }
  };

  const handleEliminarPlan = async (id) => {
    const confirm = await Swal.fire({ title: '¿Eliminar plan de pago?', text: 'Se conservará la deuda.', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#e11d48', confirmButtonText: 'Sí, eliminar' });
    if (!confirm.isConfirmed) return;
    try {
      await api.eliminarPlanPago(id);
      await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
    } catch (error) {
      Swal.fire({ title: 'No se pudo eliminar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleGuardarNuevoPP = async (payload, id = null) => {
    if (id) await api.actualizarPlanPago(id, payload);
    else await api.crearPlanPago(payload);
    setModalPPAbierto(false); setPlanPagoContexto(null);
    await Promise.all([cargarPlanPagos(), cargarPagos(), cargarPlanes(), cargarMovimientosCuenta()]);
  };

  return { handlePagarCuota, handleRegistrarAdelantoPlan, handleRevertirUltimoAdelanto, handleRevertirCuota, handleAgregarCuota, handleQuitarCuota, handleEliminarPlan, handleGuardarNuevoPP };
};