import CancelarCitaModal from '../../features/agenda/components/CancelarCitaModal';
import CitaModal from '../../features/agenda/components/CitaModal';
import CompletarCitaModal from '../../features/finanzas/components/CompletarCitaModal';
import PlanPagoModal from '../../features/finanzas/components/PlanPagoModal';
import FichaPacienteModal from '../../features/pacientes/components/FichaPaciente360Modal';
import PacienteModal from '../../features/pacientes/components/PacienteModal';
import PlanTratamientoModal from '../../features/tratamientos/components/PlanTratamientoModal';

export default function AppModals({
  modales,
  datos,
  acciones,
  cargas
}) {
  const {
    modalPacienteAbierto,
    modalFichaAbierto,
    modalCitaAbierto,
    modalCompletarAbierto,
    modalCancelarAbierto,
    modalPlanPagoAbierto,
    modalPlanAbierto,
    pacienteSeleccionado,
    citaSeleccionada,
    citaParaAccion,
    pagoParaAccion,
    planPagoContexto,
    planSeleccionado
  } = modales;
  const {
    pacientes,
    citas,
    pagos,
    planes,
    casosClinicos,
    planesPago,
    serviciosCatalogo
  } = datos;

  return (
    <>
      <PacienteModal
        key={pacienteSeleccionado ? pacienteSeleccionado.id : 'nuevo-paciente'}
        isOpen={modalPacienteAbierto}
        onClose={acciones.cerrarPaciente}
        onSave={acciones.guardarPaciente}
        pacienteEditar={pacienteSeleccionado}
      />
      <CitaModal
        key={
          citaSeleccionada?.id
            ? `cita-${citaSeleccionada.id}`
            : `nueva-cita-${citaSeleccionada?.fecha || 'sin-fecha'}-${citaSeleccionada?.hora || 'sin-hora'}`
        }
        isOpen={modalCitaAbierto}
        onClose={acciones.cerrarCita}
        onSave={acciones.guardarCita}
        citaEditar={citaSeleccionada}
        pagoEditar={
          citaSeleccionada?.id
            ? pagos.find(
                (pago) =>
                  Number(pago.citaId) === Number(citaSeleccionada.id)
              ) || null
            : null
        }
        pacientes={pacientes}
        citas={citas}
        planes={planes}
        casosClinicos={casosClinicos}
        serviciosCatalogo={serviciosCatalogo}
      />
      <CompletarCitaModal
        key={citaParaAccion ? `comp-${citaParaAccion.id}` : 'comp-modal'}
        isOpen={modalCompletarAbierto}
        onClose={acciones.cerrarCompletar}
        onSave={acciones.guardarCompletado}
        cita={citaParaAccion}
        pago={pagoParaAccion}
        serviciosCatalogo={serviciosCatalogo}
      />
      <CancelarCitaModal
        key={citaParaAccion ? `canc-${citaParaAccion.id}` : 'canc-modal'}
        isOpen={modalCancelarAbierto}
        onClose={acciones.cerrarCancelar}
        onSave={acciones.guardarCancelacion}
        cita={citaParaAccion}
        pago={pagoParaAccion}
      />
      <FichaPacienteModal
        isOpen={modalFichaAbierto}
        onClose={acciones.cerrarFicha}
        paciente={pacienteSeleccionado}
        citas={citas}
        pagos={pagos}
        planes={planes}
        casosClinicos={casosClinicos}
        planPagos={planesPago}
        onDatosActualizados={() =>
          Promise.all([
            cargas.citas(),
            cargas.pagos(),
            cargas.planesPago(),
            cargas.planes(),
            cargas.casosClinicos(),
            cargas.movimientos()
          ])
        }
        onCrearPlan={acciones.crearPlanDesdeFicha}
        onVerPlanPagos={acciones.verPlanPagosDesdeFicha}
        onNuevaCita={acciones.nuevaCitaDesdeFicha}
        onEditarPaciente={acciones.editarPaciente}
      />
      <PlanPagoModal
        isOpen={modalPlanPagoAbierto}
        onClose={acciones.cerrarPlanPago}
        onSave={acciones.guardarPlanPago}
        pacientes={pacientes}
        pagos={pagos}
        planes={planes}
        planPagos={planesPago}
        datosIniciales={planPagoContexto}
      />
      <PlanTratamientoModal
        key={
          planSeleccionado?.id ||
          planSeleccionado?.pacienteId ||
          'nuevo-plan'
        }
        isOpen={modalPlanAbierto}
        onClose={acciones.cerrarPlan}
        onSave={acciones.guardarPlan}
        planEditar={planSeleccionado}
        pacientes={pacientes}
        casosClinicos={casosClinicos}
        serviciosCatalogo={serviciosCatalogo}
      />
    </>
  );
}
