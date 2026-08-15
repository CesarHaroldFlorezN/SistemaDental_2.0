import Swal from 'sweetalert2';
import { api } from '../../services/api';

export const crearAccionesPacientes = ({
  pacientes,
  cargarPacientes,
  setPacienteSeleccionado,
  setModalFichaAbierto,
  setModalAbierto
}) => {
  const handleVerFicha = (paciente) => {
    setPacienteSeleccionado(paciente);
    setModalFichaAbierto(true);
  };

  const handleImportarCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      Swal.fire({ title: 'Importando...', text: 'Procesando pacientes, por favor espera.', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

      const respuesta = await api.importarPacientes(file);

      Swal.fire({
        title: '¡Importación Completa!',
        text: respuesta.message,
        icon: 'success',
        background: '#1e293b', color: '#fff'
      });
      cargarPacientes();
    } catch (error) {
      Swal.fire({ title: 'Error', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
    e.target.value = '';
  };
  const handleNuevoPaciente = () => { setPacienteSeleccionado(null); setModalAbierto(true); };
  const handleEditarPaciente = (paciente) => { setPacienteSeleccionado(paciente); setModalAbierto(true); };

  const handleGuardarPaciente = async (formData, id) => {
    try {
      if (!formData.nombre?.trim() || !formData.cedula?.trim()) {
        Swal.fire({ title: 'Campos incompletos', text: 'El Nombre Completo y el DNI / Cédula son obligatorios.', icon: 'warning', background: '#1e293b', color: '#fff' });
        return;
      }
      const dniDuplicado = pacientes.some(p => p.id !== id && p.cedula && p.cedula.trim() === formData.cedula.trim());
      if (dniDuplicado) {
        Swal.fire({ title: 'DNI / Cédula repetido', text: `El documento "${formData.cedula}" ya está registrado en otro paciente.`, icon: 'error', background: '#1e293b', color: '#fff' });
        return;
      }
      if (formData.codigo_ficha?.trim()) {
        const fichaDuplicada = pacientes.some(p => p.id !== id && p.codigo_ficha && p.codigo_ficha.trim().toLowerCase() === formData.codigo_ficha.trim().toLowerCase());
        if (fichaDuplicada) {
          Swal.fire({ title: 'N° de Ficha repetido', text: `La ficha "${formData.codigo_ficha}" ya se encuentra asignada.`, icon: 'error', background: '#1e293b', color: '#fff' });
          return;
        }
      }
      if (id) {
        await api.actualizarPaciente(id, formData);
        Swal.fire({ title: '¡Actualizado!', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
      } else {
        await api.crearPaciente(formData);
        Swal.fire({ title: '¡Registrado!', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
      }
      setModalAbierto(false);
      cargarPacientes();
    } catch (error) {
      Swal.fire({ title: 'No se pudo guardar', text: error.message || 'Ocurrió un error desconocido.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleEliminar = async (id, nombre) => {
    const confirm = await Swal.fire({ title: `¿Eliminar a ${nombre}?`, icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar' });
    if (confirm.isConfirmed) {
      await api.eliminarPaciente(id);
      cargarPacientes();
      Swal.fire({ title: 'Eliminado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  return {
    handleVerFicha,
    handleImportarCSV,
    handleNuevoPaciente,
    handleEditarPaciente,
    handleGuardarPaciente,
    handleEliminar
  };
};
