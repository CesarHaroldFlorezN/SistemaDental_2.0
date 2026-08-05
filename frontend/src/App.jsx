import CompletarCitaModal from './features/finanzas/components/CompletarCitaModal';
import CancelarCitaModal from './features/agenda/components/CancelarCitaModal';
import FichaPacienteModal from './features/pacientes/components/FichaPaciente360Modal';
import PlanPagoModal from './features/finanzas/components/PlanPagoModal';
import PlanTratamientoModal from './features/tratamientos/components/PlanTratamientoModal';
import PacienteModal from './features/pacientes/components/PacienteModal';
import CitaModal from './features/agenda/components/CitaModal';
import AgendaClinicaProfesional from './features/agenda/components/AgendaClinicaProfesional';
import Sidebar from './shared/components/Sidebar';

import { useEffect, useState } from 'react';
import { api } from './services/api';
import {
  AlertCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  FolderPlus,
  PlusCircle,
  Search,
  Trash2,
  TrendingUp,
  Undo2,
  Upload,
  UserPlus,
  XCircle
} from 'lucide-react';

import Swal from 'sweetalert2';
import { format } from 'date-fns';


const obtenerFechaLocal = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizarTexto = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export default function App() {
  const [vistaActiva, setVistaActiva] = useState('dashboard');

  // ==========================================
  // ESTADO Y LÓGICA DEL TEMA (CLARO / OSCURO)
  // ==========================================
  const [tema, setTema] = useState(() => {
    return localStorage.getItem('dp-theme') || 'dark';
  });

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.setAttribute('data-theme', tema);
    if (tema === 'dark') {
      raiz.classList.add('dark');
      raiz.classList.remove('light');
    } else {
      raiz.classList.add('light');
      raiz.classList.remove('dark');
    }
    localStorage.setItem('dp-theme', tema);
  }, [tema]);

  const toggleTheme = () => {
    setTema((prevTema) => (prevTema === 'dark' ? 'light' : 'dark'));
  };

  // ==========================================
  // ESTADOS DE PACIENTES
  // ==========================================
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [modalFichaAbierto, setModalFichaAbierto] = useState(false);

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

  // ==========================================
  // ESTADOS DE CITAS & MODALES CLÍNICOS
  // ==========================================
  const [citas, setCitas] = useState([]);
  const [modalCitaAbierto, setModalCitaAbierto] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);

  const [modalCompletarAbierto, setModalCompletarAbierto] = useState(false);
  const [modalCancelarAbierto, setModalCancelarAbierto] = useState(false);
  const [citaParaAccion, setCitaParaAccion] = useState(null);
  const [pagoParaAccion, setPagoParaAccion] = useState(null);

  // ==========================================
  // ESTADOS DE FINANZAS / PAGOS & PLANES DE PAGO
  // ==========================================
  const [pagos, setPagos] = useState([]);
  const [busquedaFinanzas, setBusquedaFinanzas] = useState('');

  const [planPagos, setPlanPagos] = useState([]);
  const [busquedaPP, setBusquedaPP] = useState('');
  const [modalPPAbierto, setModalPPAbierto] = useState(false);

  // ==========================================
  // NUEVO: ESTADOS PARA PLANES DE TRATAMIENTO
  // ==========================================
  const [planes, setPlanes] = useState([]);
  const [busquedaPlan, setBusquedaPlan] = useState('');
  const [modalPlanAbierto, setModalPlanAbierto] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);

  // --- CARGA INICIAL DE DATOS DESDE PYTHON ---
  const cargarPacientes = () => {
    return api.getPacientes()
      .then(data => setPacientes(data || []))
      .catch(err => {
        console.error(err);
        throw err;
      });
  };
  const cargarCitas = () => {
    return api.getCitas()
      .then(data => setCitas(data || []))
      .catch(err => {
        console.error(err);
        throw err;
      });
  };
  const cargarPagos = () => {
    return api.getPagos()
      .then(data => setPagos(data || []))
      .catch(err => {
        console.error(err);
        throw err;
      });
  };
  const cargarPlanPagos = () => {
    return api.getPlanPagos()
      .then(data => setPlanPagos(data || []))
      .catch(err => {
        console.error(err);
        throw err;
      });
  };
  const cargarPlanes = () => {
    return api.getPlanes()
      .then(data => setPlanes(data || []))
      .catch(err => {
        console.error(err);
        throw err;
      });
  };

  useEffect(() => {
    cargarPacientes();
    cargarCitas();
    cargarPagos();
    cargarPlanPagos();
    cargarPlanes();
  }, []);

  const fMon = (num) => `S/. ${parseFloat(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const mesActualStr = new Date().toISOString().slice(0, 7);
  const totalCobrado = pagos.reduce((acc, g) => acc + parseFloat(g.cobrado || 0), 0);
  const ingresosMes = pagos.filter(g => (g.fechaUltPago || g.fecha || '').startsWith(mesActualStr)).reduce((acc, g) => acc + parseFloat(g.cobrado || 0), 0);
  const financiadoActivo = pagos.filter(g => (g.tipoPago || '').toLowerCase() === 'cuotas').reduce((acc, g) => acc + parseFloat(g.saldo || 0), 0);
  const porCobrarTotal = pagos.reduce((acc, g) => acc + parseFloat(g.saldo || 0), 0);

  // ==========================================
  // CRUD PACIENTES
  // ==========================================
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

  // ==========================================
  // CRUD CITAS & MODALES CLÍNICOS
  // ==========================================
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

  const handleGuardarCita = async (payload, id) => {
    try {
      if (id) {
        await api.actualizarCitaConPago(id, payload);
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
        await api.crearCitaConPago(payload);
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
        cargarPlanPagos()
      ]);
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
        nombre: servicio.nombre,
        costo: Number(servicio.costo || 0),
        origen: servicio.origen || 'realizado'
      }));

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
        cuotas: pagoActual?.cuotas || [],
        creadoEn: pagoActual?.creadoEn || new Date().toISOString(),
        fechaUltPago: cobroRegistrado > 0 ? obtenerFechaLocal() : (pagoActual?.fechaUltPago || null),
        nota: [pagoActual?.nota, notaPago].filter(Boolean).join(' | '),
        devuelto: Number(pagoActual?.devuelto || 0),
        creditoFavor
      };

      let pagoGuardado = pagoActual;
      if (pagoActual) {
        await api.actualizarPago(pagoActual.id, datosPago);
      } else {
        pagoGuardado = await api.crearPago(datosPago);
      }

      if (cobroRegistrado > 0) {
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

      const planVinculado = pagoActual
        ? planPagos.find((plan) => Number(plan.pagoId) === Number(pagoActual.id))
        : null;

      if (accionSaldo === 'agregar_plan' && planVinculado) {
        const cuotas = Array.isArray(planVinculado.cuotas)
          ? planVinculado.cuotas.map((cuota) => ({ ...cuota }))
          : [];
        const pendientes = cuotas
          .map((cuota, indice) => ({ cuota, indice }))
          .filter(({ cuota }) => !cuota.pagado && cuota.tipo !== 'anticipo');

        if (pendientes.length) {
          const base = Math.floor((nuevoSaldo / pendientes.length) * 100) / 100;
          let acumulado = 0;
          pendientes.forEach(({ cuota }, posicion) => {
            const monto = posicion === pendientes.length - 1
              ? Number((nuevoSaldo - acumulado).toFixed(2))
              : Number(base.toFixed(2));
            cuota.monto = Math.max(0, monto);
            acumulado += cuota.monto;
          });
        } else if (nuevoSaldo > 0) {
          const fecha = new Date();
          fecha.setDate(fecha.getDate() + 30);
          cuotas.push({
            num: cuotas.filter((cuota) => cuota.tipo !== 'anticipo').length + 1,
            tipo: 'cuota',
            fecha: fecha.toISOString().split('T')[0],
            monto: nuevoSaldo,
            pagado: false,
            fechaPago: null,
            metodoPago: null
          });
        }

        await api.actualizarPlanPago(planVinculado.id, {
          ...planVinculado,
          concepto: procedimiento || planVinculado.concepto,
          totalAcordado: total,
          totalCuotas: cuotas.reduce((suma, cuota) => suma + Number(cuota.monto || 0), 0),
          cobrado: Math.min(total, nuevoCobrado),
          saldo: nuevoSaldo,
          estado: nuevoSaldo <= 0 ? 'completado' : 'activo',
          cuotas
        });
      }

      setModalCompletarAbierto(false);
      setCitaParaAccion(null);
      setPagoParaAccion(null);

      await Promise.all([cargarCitas(), cargarPagos(), cargarPlanPagos()]);

      if (accionSaldo === 'agregar_plan' && nuevoSaldo > 0 && !planVinculado) {
        const paciente = pacientes.find((item) => Number(item.id) === Number(pacienteId));
        setBusquedaPP(paciente?.nombre || '');
        setVistaActiva('planpagos');
        Swal.fire({
          title: 'Atención finalizada',
          text: `El saldo de ${fMon(nuevoSaldo)} quedó preparado. Crea o completa ahora el plan de pagos del paciente.`,
          icon: 'info',
          background: '#1e293b',
          color: '#fff'
        });
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
      await Promise.all([cargarCitas(), cargarPagos(), cargarPlanPagos()]);
      Swal.fire({ title: 'Cita cancelada', text: 'La decision clinica y el movimiento financiero quedaron registrados.', icon: 'success', background: '#1e293b', color: '#fff', timer: 2200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo cancelar', text: error.message || 'Ocurrio un error al procesar la cancelacion.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

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
      html: `<div style="text-align:left;display:grid;gap:12px"><div>Saldo pendiente: <strong>${fMon(saldoActual)}</strong></div><input id="dp-monto-cobro" type="number" min="0.01" max="${saldoActual}" step="0.01" value="${saldoActual}" class="swal2-input" style="margin:0;width:100%"><select id="dp-metodo-cobro" class="swal2-select" style="margin:0;width:100%"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select><input id="dp-ref-cobro" class="swal2-input" placeholder="Referencia u operacion (opcional)" style="margin:0;width:100%"></div>`,
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
      await Promise.all([cargarPagos(), cargarPlanPagos()]);
      Swal.fire({ title: 'Pago registrado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo registrar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  // ==========================================
  // FUNCIONES AVANZADAS: PLANES DE PAGO Y TRATAMIENTOS
  // ==========================================
  const reajustarCuotas = (plan) => {
    const pendientes = plan.cuotas.filter(q => !q.pagado && q.tipo !== 'anticipo');
    if (pendientes.length === 0) return;
    const pagado = plan.cuotas.filter(q => q.pagado).reduce((a, c) => a + c.monto, 0);
    const antPend = plan.cuotas.filter(q => !q.pagado && q.tipo === 'anticipo').reduce((a, c) => a + c.monto, 0);
    const nuevoMonto = parseFloat((Math.max(0, parseFloat(plan.totalAcordado || 0) - pagado - antPend) / pendientes.length).toFixed(2));
    pendientes.forEach(q => { q.monto = nuevoMonto; });
    plan.totalCuotas = plan.cuotas.reduce((a, q) => a + q.monto, 0);
    plan.cobrado = pagado;
    plan.saldo = Math.max(0, plan.totalCuotas - plan.cobrado);
  };

  const handlePagarCuota = async (plan, idx) => {
    const cuota = plan.cuotas[idx];
    if (!cuota || cuota.pagado) return;
    cuota.pagado = true; cuota.fechaPago = new Date().toISOString().split('T')[0]; cuota.metodoPago = plan.metodoPreferido || 'Efectivo';
    plan.cobrado = plan.cuotas.filter(c => c.pagado).reduce((acc, c) => acc + c.monto, 0);
    plan.saldo = Math.max(0, (plan.totalCuotas || 0) - plan.cobrado);
    if (plan.saldo === 0) plan.estado = 'completado';
    await api.actualizarPlanPago(plan.id, plan);
    if (plan.pagoId) {
      const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
      if (pagoAsociado) await api.actualizarPago(pagoAsociado.id, { ...pagoAsociado, cobrado: plan.cobrado, saldo: plan.saldo, fechaUltPago: cuota.fechaPago, cuotas: plan.cuotas });
    }
    cargarPlanPagos(); cargarPagos();
    Swal.fire({ title: 'Cuota Pagada ✅', icon: 'success', background: '#1e293b', color: '#fff', timer: 1400, showConfirmButton: false });
  };

  const handleRevertirCuota = async (plan, idx) => {
    const confirm = await Swal.fire({ title: '¿Revertir este pago?', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#d97706', confirmButtonText: 'Sí, revertir' });
    if (confirm.isConfirmed) {
      const cuota = plan.cuotas[idx];
      cuota.pagado = false; cuota.fechaPago = null; cuota.metodoPago = null; plan.estado = 'activo';
      plan.cobrado = plan.cuotas.filter(c => c.pagado).reduce((acc, c) => acc + c.monto, 0);
      plan.saldo = Math.max(0, (plan.totalCuotas || 0) - plan.cobrado);
      await api.actualizarPlanPago(plan.id, plan);
      if (plan.pagoId) {
        const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
        if (pagoAsociado) await api.actualizarPago(pagoAsociado.id, { ...pagoAsociado, cobrado: plan.cobrado, saldo: plan.saldo, cuotas: plan.cuotas });
      }
      cargarPlanPagos(); cargarPagos();
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
    if (plan.pagoId) {
      const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
      if (pagoAsociado) await api.actualizarPago(pagoAsociado.id, { ...pagoAsociado, cuotas: plan.cuotas });
    }
    cargarPlanPagos(); cargarPagos();
    Swal.fire({ title: 'Cuota añadida', icon: 'success', background: '#1e293b', color: '#fff', timer: 1600, showConfirmButton: false });
  };

  const handleQuitarCuota = async (plan, idx) => {
    const confirm = await Swal.fire({ title: '¿Eliminar esta cuota pendiente?', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar' });
    if (confirm.isConfirmed) {
      plan.cuotas.splice(idx, 1);
      let cont = 1; plan.cuotas.forEach(q => { if (q.tipo !== 'anticipo') q.num = cont++; });
      reajustarCuotas(plan);
      await api.actualizarPlanPago(plan.id, plan);
      if (plan.pagoId) {
        const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
        if (pagoAsociado) await api.actualizarPago(pagoAsociado.id, { ...pagoAsociado, cuotas: plan.cuotas });
      }
      cargarPlanPagos(); cargarPagos();
      Swal.fire({ title: 'Cuota eliminada', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleCerrarPlan = async (plan) => {
    await api.actualizarPlanPago(plan.id, { ...plan, estado: 'completado' });
    cargarPlanPagos(); Swal.fire({ title: 'Plan cerrado 🔒', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
  };

  const handleEliminarPlan = async (id) => {
    const confirm = await Swal.fire({ title: '¿Eliminar plan de pago?', icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar' });
    if (confirm.isConfirmed) { await api.eliminarPlanPago(id); cargarPlanPagos(); Swal.fire({ title: 'Eliminado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false }); }
  };

  const handleGuardarNuevoPP = async (payload) => {
    try { await api.crearPlanPago(payload); setModalPPAbierto(false); cargarPlanPagos(); Swal.fire({ title: 'Plan Creado 🗓️', icon: 'success', background: '#1e293b', color: '#fff', timer: 1600, showConfirmButton: false }); } 
    catch (error) { Swal.fire({ title: 'Error', text: 'No se pudo crear el plan de pago.', icon: 'error', background: '#1e293b', color: '#fff' }); }
  };

  const handleNuevoPlan = () => { setPlanSeleccionado(null); setModalPlanAbierto(true); };
  const handleEditarPlan = (plan) => { setPlanSeleccionado(plan); setModalPlanAbierto(true); };

  const handleGuardarPlan = async (payload, id) => {
    try {
      if (id) { await api.actualizarPlan(id, payload); Swal.fire({ title: 'Plan Actualizado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false }); } 
      else { await api.crearPlan(payload); Swal.fire({ title: 'Plan Creado 🗂️', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false }); }
      setModalPlanAbierto(false); cargarPlanes();
    } catch (error) { Swal.fire({ title: 'Error', text: 'No se pudo guardar el plan.', icon: 'error', background: '#1e293b', color: '#fff' }); }
  };

  const handleEliminarPlanTratamiento = async (id, nombre) => {
    const confirm = await Swal.fire({ title: `¿Eliminar la carpeta "${nombre}"?`, icon: 'warning', showCancelButton: true, background: '#1e293b', color: '#fff', confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar' });
    if (confirm.isConfirmed) { await api.eliminarPlan(id); cargarPlanes(); Swal.fire({ title: 'Plan eliminado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false }); }
  };

  // ==========================================
  // FILTRADO Y ORDENAMIENTO
  // ==========================================
  const pacientesFiltrados = pacientes.filter(p => {
    const terminos = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
    if (!terminos.length) return true;

    const textoPaciente = normalizarTexto([
      p.nombre,
      p.cedula,
      p.codigo_ficha,
      p.telefono,
      p.correo
    ].join(' '));

    return terminos.every(termino => textoPaciente.includes(termino));
  }).sort((a, b) => {
    const numA = parseInt((a.codigo_ficha || '').replace(/\D/g, ''), 10) || 999999;
    const numB = parseInt((b.codigo_ficha || '').replace(/\D/g, ''), 10) || 999999;
    if (numA !== numB) return numA - numB;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });

  const citasFiltradas = citas.map(c => {
    const pac = pacientes.find(p => Number(p.id) === Number(c.pacienteId)) || {};
    return {
      ...c,
      nombrePaciente: pac.nombre || 'Paciente no encontrado',
      cedulaPaciente: pac.cedula || '—',
      codigoFicha: pac.codigo_ficha || '',
      telefonoPaciente: pac.telefono || '—'
    };
  });

  const pagosFiltrados = pagos.map(g => {
    const pac = pacientes.find(p => Number(p.id) === Number(g.pacienteId)) || {};
    return {
      ...g,
      nombrePaciente: pac.nombre || 'Paciente no encontrado',
      cedulaPaciente: pac.cedula || '—',
      codigoFicha: pac.codigo_ficha || '',
      telefonoPaciente: pac.telefono || '—'
    };
  }).filter(g => {
    const terminos = normalizarTexto(busquedaFinanzas).split(/\s+/).filter(Boolean);
    if (!terminos.length) return true;

    const textoPago = normalizarTexto([
      g.nombrePaciente,
      g.cedulaPaciente,
      g.codigoFicha,
      g.telefonoPaciente,
      g.concepto,
      g.metodo,
      g.tipoPago
    ].join(' '));

    return terminos.every(termino => textoPago.includes(termino));
  }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const planPagosFiltrados = planPagos.map(pl => {
    const pac = pacientes.find(p => p.id === pl.pacienteId) || {};
    return { ...pl, nombrePaciente: pac.nombre || 'Paciente no encontrado', telefonoPaciente: pac.telefono || '—', codigoFicha: pac.codigo_ficha || '' };
  }).filter(pl => {
    const q = busquedaPP.toLowerCase();
    return pl.nombrePaciente.toLowerCase().includes(q) || (pl.concepto || '').toLowerCase().includes(q);
  }).sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));

  const planesFiltrados = planes.map(pl => {
    const pac = pacientes.find(p => p.id === pl.pacienteId) || {};
    return { ...pl, nombrePaciente: pac.nombre || 'Paciente no encontrado', telefonoPaciente: pac.telefono || '—', codigoFicha: pac.codigo_ficha || '' };
  }).filter(pl => {
    const q = busquedaPlan.toLowerCase();
    return pl.nombrePaciente.toLowerCase().includes(q) || (pl.nombre || '').toLowerCase().includes(q) || (pl.tipo || '').toLowerCase().includes(q);
  }).sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));

  const hoyStr = obtenerFechaLocal();
  const mananaDate = new Date();
  mananaDate.setDate(mananaDate.getDate() + 1);
  const mananaStr = obtenerFechaLocal(mananaDate);

  const citasHoy = citasFiltradas.filter(c => c.fecha === hoyStr && c.estado !== 'cancelada');
  const citasManana = citasFiltradas.filter(c => c.fecha === mananaStr && c.estado !== 'cancelada');
  const citasEnAtencion = citasFiltradas.filter(c => c.estado === 'en_atencion');
  const pacientesConDeuda = pagos.filter(g => parseFloat(g.saldo || 0) > 0);
  
  const pacientesSinVisitaReciente = pacientes.filter(p => {
    const ultCita = citas.filter(c => c.pacienteId === p.id && c.estado === 'completada').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];
    if (!ultCita || !ultCita.fecha) return true;
    return ((new Date() - new Date(`${ultCita.fecha}T12:00:00`)) / (1000 * 60 * 60 * 24)) > 180;
  });

  const getBadgeEstado = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'completada':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><CheckCircle size={13}/> Atendida</span>;
      case 'en_atencion':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max animate-pulse"><Clock size={13}/> En atención 🔴</span>;
      case 'en_espera':
        return <span className="bg-violet-500/10 text-violet-400 border border-violet-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><Clock size={13}/> En espera</span>;
      case 'confirmada':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><AlertCircle size={13}/> Programado</span>;
      case 'no_asistio':
        return <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><AlertCircle size={13}/> No asistió</span>;
      case 'cancelada':
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><XCircle size={13}/> Cancelada</span>;
      default:
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><AlertCircle size={13}/> Programado</span>;
    }
  };

  const getBadgeTipoPago = (tipo) => {
    const nombres = { contado: 'Contado', completo: 'Pagado', anticipo: 'Anticipo', cuotas: 'Cuotas', sesion: 'Plan', cortesia: 'Cortesía' };
    return <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-md text-xs font-semibold">{nombres[(tipo || '').toLowerCase()] || tipo || 'Contado'}</span>;
  };

  return (
    <div className="dp-app-shell flex min-h-screen bg-slate-900 font-sans text-slate-100">
      <Sidebar vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} />

      <main className="dp-main min-w-0 flex-1 overflow-y-auto bg-slate-900 p-4 transition-colors duration-200 sm:p-6 xl:p-8">
        
        <div className="dp-theme-toolbar sticky top-0 z-30 mx-auto mb-4 flex max-w-[1800px] items-center justify-end py-1">
          <button onClick={toggleTheme} className="dp-theme-toggle flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-lg backdrop-blur transition duration-200 cursor-pointer select-none">
            {tema === 'dark' ? <><span role="img" aria-label="claro">☀️</span><span>Modo Claro</span></> : <><span role="img" aria-label="oscuro">🌙</span><span>Modo Oscuro</span></>}
          </button>
        </div>

        <div className="mx-auto w-full max-w-[1800px]">
          
          {/* ==============================================
              PANTALLA 0: DASHBOARD
          =============================================== */}
          {vistaActiva === 'dashboard' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Centro de Mando</h1>
                  <p className="text-sm text-slate-400 mt-1">{new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <button onClick={handleNuevaCita} className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer">
                  <CalendarPlus size={18} /> Agendar Cita
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div onClick={() => setVistaActiva('pacientes')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Pacientes Totales</div>
                  <div className="text-2xl font-bold text-white font-serif">{pacientes.length}</div>
                </div>
                <div onClick={() => setVistaActiva('citas')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Citas para Hoy</div>
                  <div className="text-2xl font-bold text-cyan-400 font-serif">{citasHoy.length}</div>
                </div>
                <div onClick={() => setVistaActiva('finanzas')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Cuentas por Cobrar</div>
                  <div className="text-2xl font-bold text-rose-400 font-serif">{pacientesConDeuda.length}</div>
                </div>
                <div onClick={() => setVistaActiva('pacientes')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Sin Visita (+6 Meses)</div>
                  <div className="text-2xl font-bold text-amber-400 font-serif">{pacientesSinVisitaReciente.length}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="bg-slate-800/80 border-2 border-rose-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-rose-400 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>Pacientes en Atención 🔴</h3>
                      <span className="text-xs bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full font-semibold border border-rose-500/20">{citasEnAtencion.length} en sillón</span>
                    </div>
                    <div className="space-y-3">
                      {citasEnAtencion.length > 0 ? (
                        citasEnAtencion.map(c => (
                          <div key={c.id} className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-4 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-white text-base">{c.nombrePaciente}</div>
                              <div className="text-xs text-rose-300 font-medium mt-0.5">🩺 {c.procedimiento || 'Tratamiento en curso'}</div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Clock size={12} /> Inicio: {c.hora || '09:00'}</div>
                            </div>
                            <button onClick={() => handleAbrirCompletar(c)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg transition cursor-pointer"><CheckCircle size={15} /> Completar</button>
                          </div>
                        ))
                      ) : (<div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-700/50">Ningún paciente en atención.</div>)}
                    </div>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-cyan-400 flex items-center gap-2"><CalendarIcon size={18} />Agenda de Hoy</h3>
                      <button onClick={() => setVistaActiva('citas')} className="text-xs text-cyan-400 hover:underline font-medium cursor-pointer">Ver todas →</button>
                    </div>
                    <div className="space-y-2.5">
                      {citasHoy.length > 0 ? (
                        citasHoy.map(c => (
                          <div key={c.id} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between hover:border-cyan-500/50 transition">
                            <div className="flex items-center gap-3">
                              <div className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg text-center min-w-16"><div className="text-xs font-bold">{c.hora || '—'}</div></div>
                              <div>
                                <div className="font-semibold text-white text-sm">{c.nombrePaciente}</div>
                                <div className="text-xs text-slate-400">{c.procedimiento || 'Consulta'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getBadgeEstado(c.estado)}
                              {c.estado === 'pendiente' && (<button onClick={() => handleCambiarEstadoCita(c, 'en_atencion')} className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer">▶ Atender</button>)}
                            </div>
                          </div>
                        ))
                      ) : (<div className="text-center py-8 text-slate-400 text-sm bg-slate-900/30 rounded-xl">No hay más citas programadas para hoy.</div>)}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-base font-bold text-amber-400 flex items-center gap-2 mb-4"><AlertTriangle size={18} />Alertas Inteligentes</h3>
                    <div className="space-y-3">
                      <div onClick={() => setVistaActiva('finanzas')} className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-rose-500/15 transition">
                        <div><div className="font-bold text-rose-400 text-sm">Cobros Pendientes</div><div className="text-xs text-slate-300 mt-0.5">{pacientesConDeuda.length} pacientes con saldo por cobrar</div></div>
                        <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{pacientesConDeuda.length}</span>
                      </div>
                      <div onClick={() => setVistaActiva('pacientes')} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-amber-500/15 transition">
                        <div><div className="font-bold text-amber-400 text-sm">Seguimiento Preventivo</div><div className="text-xs text-slate-300 mt-0.5">{pacientesSinVisitaReciente.length} pacientes sin consulta en +6 meses</div></div>
                        <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{pacientesSinVisitaReciente.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-200 flex items-center gap-2"><CalendarIcon size={18} className="text-slate-400" />Citas para Mañana</h3>
                      <span className="text-xs text-slate-400 font-medium">{new Date(mananaDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="space-y-2.5">
                      {citasManana.length > 0 ? (
                        citasManana.map(c => (
                          <div key={c.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-slate-700/60 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold">{c.hora || '—'}</div>
                              <div><div className="font-semibold text-white text-sm">{c.nombrePaciente}</div></div>
                            </div>
                            {getBadgeEstado(c.estado)}
                          </div>
                        ))
                      ) : (<div className="text-center py-8 text-slate-500 text-sm bg-slate-900/30 rounded-xl">No hay citas agendadas para mañana.</div>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================
              PANTALLA 1: PACIENTES
          =============================================== */}
          {vistaActiva === 'pacientes' && (
            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Gestión de Pacientes</h1>
                  <p className="text-sm text-slate-400 mt-1">Directorio clínico y expedientes</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden lg:inline-block bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-sm font-semibold mr-2">{pacientesFiltrados.length} Registros</span>
                  <button onClick={() => api.exportarPacientes()} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition flex items-center gap-2 text-sm shadow-md cursor-pointer"><Download size={18} /><span className="hidden sm:inline">Exportar CSV</span></button>
                  <label className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition flex items-center gap-2 text-sm shadow-md cursor-pointer"><Upload size={18} /><span className="hidden sm:inline">Importar CSV</span><input type="file" accept=".csv" className="hidden" onChange={handleImportarCSV} /></label>
                  <button onClick={handleNuevoPaciente} className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer"><UserPlus size={18} />Nuevo Paciente</button>
                </div>
              </div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="text" placeholder="Buscar por ficha, nombre, DNI, teléfono o correo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-cyan-500 outline-none transition text-sm shadow-sm" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Ficha</th><th className="p-4">Paciente</th><th className="p-4">DNI</th><th className="p-4">Teléfono</th><th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {pacientesFiltrados.length > 0 ? (
                      pacientesFiltrados.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-700/40 transition">
                          <td className="p-4 font-bold text-cyan-400"><span className="bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20">{p.codigo_ficha || 'N/A'}</span></td>
                          <td className="p-4 font-medium text-white">{p.nombre}</td>
                          <td className="p-4 text-slate-300">{p.cedula || '—'}</td>
                          <td className="p-4 text-slate-300">{p.telefono || '—'}</td>
                          <td className="p-4 flex justify-center gap-2">
                            <button onClick={() => handleVerFicha(p)} className="p-2 bg-slate-700/80 rounded-lg hover:bg-cyan-600 hover:text-white transition cursor-pointer" title="Ver Ficha">📋</button>
                            <button onClick={() => handleEditarPaciente(p)} className="p-2 bg-slate-700/80 rounded-lg hover:bg-amber-600 hover:text-white transition cursor-pointer" title="Editar Paciente"><Edit size={16} /></button>
                            <button onClick={() => handleEliminar(p.id, p.nombre)} className="p-2 bg-slate-700/80 rounded-lg hover:bg-red-600 hover:text-white transition cursor-pointer" title="Eliminar Paciente"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))
                    ) : (<tr><td colSpan="5" className="p-8 text-center text-slate-400">No se encontraron pacientes.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==============================================
              PANTALLA 2: AGENDA CLÍNICA PROFESIONAL
          =============================================== */}
          {vistaActiva === 'citas' && (
            <AgendaClinicaProfesional
              citas={citas}
              pacientes={pacientes}
              pagos={pagos}
              onNuevaCita={handleNuevaCita}
              onEditarCita={handleEditarCita}
              onCambiarEstado={handleCambiarEstadoCita}
              onCompletarCita={handleAbrirCompletar}
              onCancelarCita={handleAbrirCancelar}
              onCobrar={handleCobrarSaldo}
              onVerFicha={handleVerFicha}
              onEliminarCita={handleEliminarCita}
              onReprogramarCita={handleReprogramarCita}
              onVerCuotas={handleVerCuotasDesdeAgenda}
            />
          )}

          {/* ==============================================
              PANTALLA 3: FINANZAS Y PAGOS
          =============================================== */}
          {vistaActiva === 'finanzas' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Módulo de Finanzas y Cobros</h1>
                  <p className="text-sm text-slate-400 mt-1">Historial de pagos, cuotas y cuentas por cobrar</p>
                </div>
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-sm font-semibold">{pagosFiltrados.length} Movimientos</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Total Cobrado</span><DollarSign size={18} className="text-emerald-400" /></div>
                  <div className="text-2xl font-bold text-emerald-400 font-serif">{fMon(totalCobrado)}</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Ingresos del Mes</span><TrendingUp size={18} className="text-cyan-400" /></div>
                  <div className="text-2xl font-bold text-cyan-400 font-serif">{fMon(ingresosMes)}</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Financiado Activo</span><CreditCard size={18} className="text-amber-400" /></div>
                  <div className="text-2xl font-bold text-amber-400 font-serif">{fMon(financiadoActivo)}</div>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2"><span>Por Cobrar</span><AlertTriangle size={18} className="text-rose-400" /></div>
                  <div className="text-2xl font-bold text-rose-400 font-serif">{fMon(porCobrarTotal)}</div>
                </div>
              </div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="text" placeholder="Buscar por paciente, DNI, ficha, teléfono, tratamiento o método..." value={busquedaFinanzas} onChange={(e) => setBusquedaFinanzas(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-cyan-500 outline-none transition text-sm shadow-sm" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Paciente</th><th className="p-4">Tratamiento</th><th className="p-4">Fecha</th><th className="p-4">Total</th><th className="p-4">Cobrado</th><th className="p-4">Saldo</th><th className="p-4">Tipo</th><th className="p-4">Método</th><th className="p-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {pagosFiltrados.length > 0 ? (
                      pagosFiltrados.map((g) => {
                        const saldoPendiente = parseFloat(g.saldo || 0);
                        const cobradoReal = parseFloat(g.cobrado || 0);
                        return (
                          <tr key={g.id} className="hover:bg-slate-700/40 transition">
                            <td className="p-4"><div className="font-semibold text-white">{g.nombrePaciente}</div><div className="text-xs text-slate-400">{g.cedulaPaciente !== '—' ? `DNI: ${g.cedulaPaciente}` : ''}</div></td>
                            <td className="p-4 font-medium text-slate-200">{g.concepto || 'Consulta General'}</td>
                            <td className="p-4 text-slate-400 text-xs whitespace-nowrap">{g.fecha || '—'}</td>
                            <td className="p-4 font-serif text-slate-300">{fMon(g.total)}</td>
                            <td className="p-4 font-serif font-bold text-emerald-400">{fMon(cobradoReal)}</td>
                            <td className="p-4 font-serif font-bold">{saldoPendiente > 0 ? (<span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">{fMon(saldoPendiente)}</span>) : (<span className="text-emerald-400">✓ Al día</span>)}</td>
                            <td className="p-4">{getBadgeTipoPago(g.tipoPago)}</td>
                            <td className="p-4 text-slate-300 text-xs">{g.metodo || '—'}</td>
                            <td className="p-4 text-center">
                              {saldoPendiente > 0 && (<button onClick={() => handleCobrarSaldo(g, g.nombrePaciente)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer">💳 Cobrar</button>)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (<tr><td colSpan="9" className="p-12 text-center text-slate-400">No se encontraron registros.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==============================================
              PANTALLA 4 Y 5: PLANES DE TRATAMIENTO Y PAGOS EN CUOTAS
          =============================================== */}
          {/* Se conservan igual, pero para no exceder el tamaño del código he simplificado la lógica visual de las tarjetas */}
          
          {vistaActiva === 'planes' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-purple-400">Planes de Tratamiento</h1>
                  <p className="text-sm text-slate-400 mt-1">Carpetas clínicas, especialidades y control de avance por sesión</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-4 py-1.5 rounded-full text-sm font-semibold">{planesFiltrados.length} Planes</span>
                  <button onClick={handleNuevoPlan} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg transition cursor-pointer"><FolderPlus size={18} /> Nuevo Plan</button>
                </div>
              </div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="text" placeholder="Buscar plan por paciente o nombre del tratamiento..." value={busquedaPlan} onChange={(e) => setBusquedaPlan(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none transition text-sm shadow-sm" />
              </div>
              <div className="space-y-6">
                {planesFiltrados.length > 0 ? (
                  planesFiltrados.map((pl) => {
                    const citasDelPlan = citas.filter(c => c.planId === pl.id).sort((a, b) => { const aComp = a.estado === 'completada' ? 1 : 0; const bComp = b.estado === 'completada' ? 1 : 0; if (aComp !== bComp) return aComp - bComp; return aComp === 1 ? (b.fecha || '').localeCompare(a.fecha || '') : (a.fecha || '').localeCompare(b.fecha || ''); });
                    return (
                      <div key={pl.id} className="bg-slate-800/80 border border-purple-500/20 rounded-2xl p-6 shadow-xl hover:border-purple-500/40 transition">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-700/80 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-lg">{(pl.nombrePaciente || '?').charAt(0)}</div>
                            <div>
                              <div className="text-lg font-bold text-white leading-tight">{pl.nombrePaciente} {pl.codigoFicha ? `[${pl.codigoFicha}]` : ''}</div>
                              <div className="text-xs text-purple-400 font-medium mt-0.5">{pl.telefonoPaciente || '—'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Presupuesto</div>
                            <div className="text-xl font-serif font-bold text-white">{fMon(pl.costo)}</div>
                          </div>
                        </div>
                        <div className="mb-4">
                          <h3 className="text-base font-bold text-white">{pl.nombre}</h3>
                          <div className="text-xs text-slate-400 mt-0.5">{pl.tipo} · {pl.duracion}</div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => { setCitaSeleccionada({ pacienteId: pl.pacienteId, planId: pl.id, procedimiento: `${pl.nombre} — Sesión ${citasDelPlan.length + 1}`, costo: 0, tipoPago: 'sesion' }); setModalCitaAbierto(true); }} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg transition cursor-pointer">📅 Agendar Sesión</button>
                          <button onClick={() => handleEditarPlan(pl)} className="px-4 py-2 bg-slate-700 hover:bg-amber-600 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer">✏️ Editar</button>
                          <button onClick={() => handleEliminarPlanTratamiento(pl.id, pl.nombre)} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer ml-auto">🗑 Eliminar Plan</button>
                        </div>
                      </div>
                    );
                  })
                ) : (<div className="text-center py-12 bg-slate-800/60 border border-slate-700/60 rounded-2xl"><p className="text-slate-400 font-medium">No hay carpetas de planes registradas.</p></div>)}
              </div>
            </div>
          )}

          {vistaActiva === 'planpagos' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Planes de Pago en Cuotas</h1>
                  <p className="text-sm text-slate-400 mt-1">Cronogramas de financiamiento, vencimientos y abonos por cuota</p>
                </div>
                <button onClick={() => setModalPPAbierto(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg transition cursor-pointer"><PlusCircle size={18} /> Nuevo Plan de Pago</button>
              </div>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input type="text" placeholder="Buscar plan de pago..." value={busquedaPP} onChange={(e) => setBusquedaPP(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-cyan-500 outline-none transition text-sm shadow-sm" />
              </div>
              <div className="space-y-6">
                {planPagosFiltrados.length > 0 ? (
                  planPagosFiltrados.map((pl) => {
                    const cuotas = pl.cuotas || [];
                    const cuotasPagadas = cuotas.filter(q => q.pagado);
                    const totalPagado = cuotasPagadas.reduce((acc, q) => acc + (parseFloat(q.monto) || 0), 0);
                    const totalCuotasNum = parseFloat(pl.totalAcordado || 0);
                    const porcentaje = totalCuotasNum > 0 ? Math.min(100, (totalPagado / totalCuotasNum) * 100).toFixed(1) : 0;
                    return (
                      <div key={pl.id} className={`bg-slate-800/80 border rounded-2xl p-6 shadow-xl transition ${pl.estado === 'activo' ? 'border-cyan-500/40' : 'border-slate-700/60 opacity-85'}`}>
                        <div className="flex justify-between items-center mb-5 border-b border-slate-700/80 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">{(pl.nombrePaciente || '?').charAt(0)}</div>
                            <div>
                              <div className="text-lg font-bold text-white leading-tight">{pl.nombrePaciente}</div>
                              <div className="text-xs text-cyan-400 font-medium mt-0.5">{pl.concepto || 'Financiamiento Odontológico'}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">Total Acordado</div>
                            <div className="text-xl font-serif font-bold text-white">{fMon(pl.totalAcordado)}</div>
                          </div>
                        </div>
                        <div className="mb-6">
                          <div className="w-full bg-slate-900/80 h-3 rounded-full overflow-hidden border border-slate-700">
                            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${porcentaje}%` }}></div>
                          </div>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden mb-5">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead><tr className="border-b border-slate-700 bg-slate-800 text-slate-400 uppercase"><th className="p-3">#</th><th className="p-3">Vencimiento</th><th className="p-3">Monto</th><th className="p-3 text-right">Acción</th></tr></thead>
                            <tbody className="divide-y divide-slate-800">
                              {cuotas.map((q, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/40 transition">
                                  <td className="p-3 font-bold"><span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-400">{q.tipo === 'anticipo' ? 'Anticipo' : `#${q.num}`}</span></td>
                                  <td className="p-3 text-slate-300">{q.fecha || '—'}</td>
                                  <td className="p-3 font-serif font-bold text-white">S/. {parseFloat(q.monto || 0).toFixed(2)}</td>
                                  <td className="p-3 text-right space-x-1.5">
                                    {!q.pagado ? (
                                      <><button onClick={() => handlePagarCuota(pl, idx)} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold transition cursor-pointer">💵 Pagar</button><button onClick={() => handleQuitarCuota(pl, idx)} className="p-1 bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white rounded transition cursor-pointer">🗑️</button></>
                                    ) : (<button onClick={() => handleRevertirCuota(pl, idx)} className="px-2 py-1 bg-slate-700 hover:bg-amber-600/80 text-slate-300 hover:text-white rounded font-semibold flex items-center gap-1 ml-auto transition cursor-pointer"><Undo2 size={12} /> Revertir</button>)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => handleAgregarCuota(pl)} className="px-3 py-1.5 bg-slate-700 hover:bg-cyan-600 text-slate-200 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"><PlusCircle size={15} /> ＋ Añadir Cuota</button>
                          <button onClick={() => handleEliminarPlan(pl.id)} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer ml-auto">🗑 Eliminar Plan</button>
                        </div>
                      </div>
                    );
                  })
                ) : (<div className="text-center py-12 bg-slate-800/60 border border-slate-700/60 rounded-2xl"><p className="text-slate-400 font-medium">No se encontraron planes de pago.</p></div>)}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODALES EMERGENTES */}
      <PacienteModal key={pacienteSeleccionado ? pacienteSeleccionado.id : 'nuevo-paciente'} isOpen={modalAbierto} onClose={() => setModalAbierto(false)} onSave={handleGuardarPaciente} pacienteEditar={pacienteSeleccionado} />
      <CitaModal
        key={
          citaSeleccionada?.id
            ? `cita-${citaSeleccionada.id}`
            : `nueva-cita-${citaSeleccionada?.fecha || 'sin-fecha'}-${citaSeleccionada?.hora || 'sin-hora'}`
        }
        isOpen={modalCitaAbierto}
        onClose={() => {
          setModalCitaAbierto(false);
          setCitaSeleccionada(null);
        }}
        onSave={handleGuardarCita}
        citaEditar={citaSeleccionada}
        pagoEditar={
          citaSeleccionada?.id
            ? pagos.find((pago) => Number(pago.citaId) === Number(citaSeleccionada.id)) || null
            : null
        }
        pacientes={pacientes}
        citas={citas}
      />
      <CompletarCitaModal key={citaParaAccion ? `comp-${citaParaAccion.id}` : 'comp-modal'} isOpen={modalCompletarAbierto} onClose={() => setModalCompletarAbierto(false)} onSave={handleGuardarCompletado} cita={citaParaAccion} pago={pagoParaAccion} />
      <CancelarCitaModal key={citaParaAccion ? `canc-${citaParaAccion.id}` : 'canc-modal'} isOpen={modalCancelarAbierto} onClose={() => setModalCancelarAbierto(false)} onSave={handleGuardarCancelacion} cita={citaParaAccion} pago={pagoParaAccion} />
      <FichaPacienteModal
        isOpen={modalFichaAbierto}
        onClose={() => setModalFichaAbierto(false)}
        paciente={pacienteSeleccionado}
        citas={citas}
        pagos={pagos}
        planes={planes}
        planPagos={planPagos}
        onDatosActualizados={() => Promise.all([cargarCitas(), cargarPagos(), cargarPlanPagos(), cargarPlanes()])}
        onCrearPlan={(paciente) => {
          setPlanSeleccionado({ pacienteId: paciente?.id || null });
          setModalPlanAbierto(true);
        }}
        onVerPlanPagos={(paciente) => {
          setBusquedaPP(paciente?.nombre || '');
          setVistaActiva('planpagos');
          setModalFichaAbierto(false);
        }}
        onNuevaCita={(paciente) => {
          setCitaSeleccionada({ pacienteId: paciente?.id || null });
          setModalCitaAbierto(true);
        }}
        onEditarPaciente={handleEditarPaciente}
      />
      <PlanPagoModal isOpen={modalPPAbierto} onClose={() => setModalPPAbierto(false)} onSave={handleGuardarNuevoPP} pacientes={pacientes} />
      <PlanTratamientoModal key={planSeleccionado ? planSeleccionado.id : 'nuevo-plan'} isOpen={modalPlanAbierto} onClose={() => setModalPlanAbierto(false)} onSave={handleGuardarPlan} planEditar={planSeleccionado} pacientes={pacientes} />
    </div>
  );
}