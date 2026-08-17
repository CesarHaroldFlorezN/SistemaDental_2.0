import Swal from 'sweetalert2';
import { api } from '../../services/api';

export const crearAccionesPlanesTratamiento = ({
  cargarPlanes,
  cargarPagos,
  cargarPlanPagos,
  cargarCasosClinicos,
  setPlanSeleccionado,
  setModalPlanAbierto,
  setPlanPagoContexto,
  setModalPPAbierto
}) => {
  const handleNuevoPlan = () => { setPlanSeleccionado(null); setModalPlanAbierto(true); };
  const handleEditarPlan = (plan) => { setPlanSeleccionado(plan); setModalPlanAbierto(true); };

  const handleGuardarPlan = async (payload, id, opciones = {}) => {
    try {
      const respuesta = id
        ? await api.actualizarPlan(id, payload)
        : await api.crearPlan(payload);
      const planGuardado = respuesta?.registro || respuesta;
      setModalPlanAbierto(false);
      setPlanSeleccionado(null);
      await Promise.all([
        cargarPlanes(),
        cargarPagos(),
        cargarPlanPagos(),
        cargarCasosClinicos()
      ]);

      if (opciones.abrirPlanPago && planGuardado?.pago) {
        setPlanPagoContexto({
          pacienteId: planGuardado.pacienteId,
          pagoId: planGuardado.pago.id,
          planId: planGuardado.id,
          casoClinicoId: planGuardado.casoClinicoId,
          concepto: planGuardado.nombre,
          totalAcordado: planGuardado.pago.total,
          cobrado: planGuardado.pago.cobrado,
          nSesiones: planGuardado.nSesiones,
          sesiones: planGuardado.sesiones || [],
          origen: 'plan_tratamiento'
        });
        setModalPPAbierto(true);
      }

      Swal.fire({ title: id ? 'Plan actualizado' : 'Plan y sesiones creados', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo guardar', text: error.message || 'No se pudo guardar el plan.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleEliminarPlanTratamiento = async (id, nombre) => {
    const confirm = await Swal.fire({ title: `¿Eliminar la carpeta "${nombre}"?`, icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar' });
    if (confirm.isConfirmed) { await api.eliminarPlan(id); cargarPlanes(); Swal.fire({ title: 'Plan eliminado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false }); }
  };

  return {
    handleNuevoPlan,
    handleEditarPlan,
    handleGuardarPlan,
    handleEliminarPlanTratamiento
  };
};
