import CompletarCitaModal from './components/CompletarCitaModal';
import CancelarCitaModal from './components/CancelarCitaModal';
import FichaPacienteModal from './components/FichaPacienteModal';
import PlanPagoModal from './components/PlanPagoModal';
import PlanTratamientoModal from './components/PlanTratamientoModal';
import { useState, useEffect } from 'react';
import { api } from './services/api';
import PacienteModal from './components/PacienteModal';
import CitaModal from './components/CitaModal';
import Sidebar from './components/Sidebar';
import { 
  Search, Edit, Trash2, UserPlus, 
  CalendarPlus, Calendar as CalendarIcon, Clock, 
  CheckCircle, XCircle, AlertCircle,
  DollarSign, TrendingUp, CreditCard, AlertTriangle, PlusCircle, Lock, Undo2, FolderPlus, FolderKanban
} from 'lucide-react';
import Swal from 'sweetalert2';

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

  // ==========================================
  // ESTADOS DE CITAS & MODALES CLÍNICOS
  // ==========================================
  const [citas, setCitas] = useState([]);
  const [busquedaCita, setBusquedaCita] = useState('');
  const [filtroEstadoCita, setFiltroEstadoCita] = useState('Todos');
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
    api.getPacientes()
      .then(data => setPacientes(data || []))
      .catch(err => console.error("Error cargando pacientes:", err));
  };

  const cargarCitas = () => {
    api.getCitas()
      .then(data => setCitas(data || []))
      .catch(err => console.error("Error cargando citas:", err));
  };

  const cargarPagos = () => {
    api.getPagos()
      .then(data => setPagos(data || []))
      .catch(err => console.error("Error cargando pagos:", err));
  };

  const cargarPlanPagos = () => {
    api.getPlanPagos()
      .then(data => setPlanPagos(data || []))
      .catch(err => console.error("Error cargando planes de pago:", err));
  };

  const cargarPlanes = () => {
    api.getPlanes()
      .then(data => setPlanes(data || []))
      .catch(err => console.error("Error cargando planes de tratamiento:", err));
  };

  useEffect(() => {
    cargarPacientes();
    cargarCitas();
    cargarPagos();
    cargarPlanPagos();
    cargarPlanes();
  }, []);

  // ==========================================
  // FORMATEADOR DE MONEDA (SOLES)
  // ==========================================
  const fMon = (num) => {
    const valor = parseFloat(num || 0);
    return `S/. ${valor.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ==========================================
  // CÁLCULOS PARA LAS TARJETAS FINANCIERAS
  // ==========================================
  const mesActualStr = new Date().toISOString().slice(0, 7);

  const totalCobrado = pagos.reduce((acc, g) => acc + parseFloat(g.cobrado || 0), 0);
  
  const ingresosMes = pagos
    .filter(g => (g.fechaUltPago || g.fecha || '').startsWith(mesActualStr))
    .reduce((acc, g) => acc + parseFloat(g.cobrado || 0), 0);
    
  const financiadoActivo = pagos
    .filter(g => (g.tipoPago || '').toLowerCase() === 'cuotas')
    .reduce((acc, g) => acc + parseFloat(g.saldo || 0), 0);
    
  const porCobrarTotal = pagos.reduce((acc, g) => acc + parseFloat(g.saldo || 0), 0);

  // ==========================================
  // CRUD PACIENTES
  // ==========================================
  const handleNuevoPaciente = () => {
    setPacienteSeleccionado(null);
    setModalAbierto(true);
  };

  const handleEditarPaciente = (paciente) => {
    setPacienteSeleccionado(paciente);
    setModalAbierto(true);
  };

  const handleGuardarPaciente = async (formData, id) => {
    try {
      // 1. Validación de campos obligatorios
      if (!formData.nombre?.trim() || !formData.cedula?.trim()) {
        Swal.fire({
          title: 'Campos incompletos',
          text: 'El Nombre Completo y el DNI / Cédula son obligatorios.',
          icon: 'warning',
          background: '#1e293b',
          color: '#fff'
        });
        return;
      }

      // 2. Validación de DNI duplicado (omitiendo al paciente actual si es edición)
      const dniDuplicado = pacientes.some(
        p => p.id !== id && 
             p.cedula && 
             p.cedula.trim() === formData.cedula.trim()
      );

      if (dniDuplicado) {
        Swal.fire({
          title: 'DNI / Cédula repetido',
          text: `El documento "${formData.cedula}" ya está registrado en otro paciente.`,
          icon: 'error',
          background: '#1e293b',
          color: '#fff'
        });
        return;
      }

      // 3. Validación de ID de Ficha duplicado (solo si se ingresó un código)
      if (formData.codigo_ficha?.trim()) {
        const fichaDuplicada = pacientes.some(
          p => p.id !== id && 
               p.codigo_ficha && 
               p.codigo_ficha.trim().toLowerCase() === formData.codigo_ficha.trim().toLowerCase()
        );

        if (fichaDuplicada) {
          Swal.fire({
            title: 'N° de Ficha repetido',
            text: `La ficha "${formData.codigo_ficha}" ya se encuentra asignada a otro expediente.`,
            icon: 'error',
            background: '#1e293b',
            color: '#fff'
          });
          return;
        }
      }

      // 4. Si todo está correcto, guardamos en base de datos
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
      console.error("Error al guardar paciente:", error);
      
      // AHORA TE MOSTRARÁ EL MOTIVO EXACTO DEL RECHAZO
      Swal.fire({ 
        title: 'No se pudo guardar', 
        text: error.message || 'Ocurrió un error desconocido en el servidor.', 
        icon: 'error', 
        background: '#1e293b', 
        color: '#fff' 
      });
    }
  };

  const handleEliminar = async (id, nombre) => {
    const confirm = await Swal.fire({
      title: `¿Eliminar a ${nombre}?`,
      icon: 'warning',
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar'
    });

    if (confirm.isConfirmed) {
      await api.eliminarPaciente(id);
      cargarPacientes();
      Swal.fire({ title: 'Eliminado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  // ==========================================
  // CRUD CITAS & MODALES CLÍNICOS
  // ==========================================
  const handleNuevaCita = () => {
    setCitaSeleccionada(null);
    setModalCitaAbierto(true);
  };

  const handleEditarCita = (cita) => {
    setCitaSeleccionada(cita);
    setModalCitaAbierto(true);
  };

  const handleGuardarCita = async (payload, id) => {
    try {
      if (id) {
        await api.actualizarCita(id, payload);
        Swal.fire({ title: 'Cita Actualizada', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
      } else {
        await api.crearCita(payload);
        Swal.fire({ title: 'Cita Agendada', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
      }
      setModalCitaAbierto(false);
      cargarCitas();
      cargarPagos();
      cargarPlanPagos();
    } catch (error) {
      console.error(error);
      Swal.fire({ title: 'Error', text: 'No se pudo guardar la cita.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleEliminarCita = async (id, nombrePaciente) => {
    const confirm = await Swal.fire({
      title: `¿Eliminar cita de ${nombrePaciente}?`,
      icon: 'warning',
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar'
    });

    if (confirm.isConfirmed) {
      await api.eliminarCita(id);
      cargarCitas();
      Swal.fire({ title: 'Cita eliminada', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleCambiarEstadoCita = async (cita, nuevoEstado) => {
    try {
      await api.actualizarCita(cita.id, { ...cita, estado: nuevoEstado });
      cargarCitas();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAbrirCompletar = (cita) => {
    const pagoAsociado = pagos.find(p => p.citaId === cita.id);
    setCitaParaAccion(cita);
    setPagoParaAccion(pagoAsociado || null);
    setModalCompletarAbierto(true);
  };

  const handleAbrirCancelar = (cita) => {
    const pagoAsociado = pagos.find(p => p.citaId === cita.id);
    setCitaParaAccion(cita);
    setPagoParaAccion(pagoAsociado || null);
    setModalCancelarAbierto(true);
  };

  const handleGuardarCompletado = async ({ citaId, pacienteId, citaBaseId, procedimiento, costoExtra, modoPagoExtra, notasFin }) => {
    try {
      const citaActual = citas.find(c => c.id === citaId);
      if (!citaActual) return;

      if (costoExtra > 0) {
        if (citaBaseId) {
          if (modoPagoExtra === 'separado') {
            await api.crearPago({
              pacienteId,
              citaId,
              concepto: `Adicional: ${procedimiento}`,
              fecha: new Date().toISOString().split('T')[0],
              total: costoExtra,
              cobrado: 0,
              saldo: costoExtra,
              metodo: '—',
              tipoPago: 'contado',
              cuotas: [],
              creadoEn: new Date().toISOString()
            });
          } else if (modoPagoExtra === 'sumar_plan') {
            const pagoPadre = pagos.find(p => p.citaId === citaBaseId);
            if (pagoPadre) {
              await api.actualizarPago(pagoPadre.id, {
                ...pagoPadre,
                total: parseFloat(pagoPadre.total || 0) + costoExtra,
                saldo: parseFloat(pagoPadre.saldo || 0) + costoExtra
              });
            }
          }
        } else {
          const nuevoCosto = (parseFloat(citaActual.costo || 0) + costoExtra);
          citaActual.costo = nuevoCosto;
          const pagoCita = pagos.find(p => p.citaId === citaId);
          if (pagoCita) {
            await api.actualizarPago(pagoCita.id, {
              ...pagoCita,
              total: nuevoCosto,
              saldo: parseFloat(pagoCita.saldo || 0) + costoExtra
            });
          }
        }
      }

      const citaActualizada = {
        ...citaActual,
        procedimiento,
        estado: 'completada',
        notasFin,
        fin: new Date().toISOString()
      };

      await api.actualizarCita(citaId, citaActualizada);
      setModalCompletarAbierto(false);
      cargarCitas();
      cargarPagos();

      Swal.fire({
        title: 'Atención Completada',
        text: 'El historial clínico y financiero fue actualizado.',
        icon: 'success',
        background: '#1e293b',
        color: '#fff',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (error) {
      console.error("Error al completar cita:", error);
      Swal.fire({ title: 'Error', text: 'No se pudo guardar la atención.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleGuardarCancelacion = async ({ citaId, pagoId, motivoCancelacion, opcionDevolucion, montoCobrado }) => {
    try {
      const citaActual = citas.find(c => c.id === citaId);
      if (!citaActual) return;

      if (pagoId && montoCobrado > 0) {
        const pagoActual = pagos.find(p => p.id === pagoId);
        if (pagoActual) {
          let cambiosPago = { ...pagoActual, tipoPago: `cancelado_${opcionDevolucion}` };
          
          if (opcionDevolucion === 'total_dev') {
            cambiosPago = { ...cambiosPago, cobrado: 0, saldo: 0, devuelto: montoCobrado, nota: 'Devuelto por cancelación' };
          } else if (opcionDevolucion === 'credito') {
            cambiosPago = { ...cambiosPago, creditoFavor: montoCobrado, saldo: 0, nota: 'Crédito a favor' };
          }
          await api.actualizarPago(pagoId, cambiosPago);
        }
      }

      const citaCancelada = {
        ...citaActual,
        estado: 'cancelada',
        motivoCancelacion,
        canceladaEn: new Date().toISOString()
      };

      await api.actualizarCita(citaId, citaCancelada);
      setModalCancelarAbierto(false);
      cargarCitas();
      cargarPagos();

      Swal.fire({
        title: 'Cita Cancelada',
        text: 'El expediente fue modificado.',
        icon: 'warning',
        background: '#1e293b',
        color: '#fff',
        timer: 1800,
        showConfirmButton: false
      });
    } catch (error) {
      console.error("Error al cancelar cita:", error);
      Swal.fire({ title: 'Error', text: 'No se pudo procesar la cancelación.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  // ==========================================
  // COBRO RÁPIDO DESDE FINANZAS
  // ==========================================
  const handleCobrarSaldo = async (pago, nombrePaciente) => {
    const { value: montoAbono } = await Swal.fire({
      title: `Cobrar saldo a ${nombrePaciente}`,
      text: `Deuda pendiente: ${fMon(pago.saldo)}`,
      input: 'number',
      inputLabel: 'Monto a abono hoy (S/.)',
      inputValue: pago.saldo,
      inputAttributes: {
        min: '0.1',
        max: pago.saldo,
        step: '0.5'
      },
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#0891b2',
      confirmButtonText: 'Registrar Cobro',
      cancelButtonText: 'Cancelar'
    });

    if (montoAbono) {
      const abono = parseFloat(montoAbono);
      const nuevoCobrado = parseFloat(pago.cobrado || 0) + abono;
      const nuevoSaldo = Math.max(0, parseFloat(pago.total || 0) - nuevoCobrado);

      const pagoActualizado = {
        ...pago,
        cobrado: nuevoCobrado,
        saldo: nuevoSaldo,
        fechaUltPago: new Date().toISOString().split('T')[0],
        tipoPago: nuevoSaldo === 0 && pago.tipoPago !== 'cuotas' ? 'completo' : pago.tipoPago
      };

      await api.actualizarPago(pago.id, pagoActualizado);
      cargarPagos();
      cargarPlanPagos();
      Swal.fire({
        title: '¡Cobrado!',
        text: `Abono de ${fMon(abono)} registrado correctamente.`,
        icon: 'success',
        background: '#1e293b',
        color: '#fff',
        timer: 1800,
        showConfirmButton: false
      });
    }
  };

  // ==========================================
  // FUNCIONES AVANZADAS: PLANES DE PAGO (CUOTAS)
  // ==========================================
  const reajustarCuotas = (plan) => {
    const pendientes = plan.cuotas.filter(q => !q.pagado && q.tipo !== 'anticipo');
    if (pendientes.length === 0) return;
    const pagado = plan.cuotas.filter(q => q.pagado).reduce((a, c) => a + c.monto, 0);
    const antPend = plan.cuotas.filter(q => !q.pagado && q.tipo === 'anticipo').reduce((a, c) => a + c.monto, 0);

    const aDistribuir = Math.max(0, parseFloat(plan.totalAcordado || 0) - pagado - antPend);
    const nuevoMonto = parseFloat((aDistribuir / pendientes.length).toFixed(2));

    pendientes.forEach(q => { q.monto = nuevoMonto; });
    plan.totalCuotas = plan.cuotas.reduce((a, q) => a + q.monto, 0);
    plan.cobrado = pagado;
    plan.saldo = Math.max(0, plan.totalCuotas - plan.cobrado);
  };

  const handlePagarCuota = async (plan, idx) => {
    const cuota = plan.cuotas[idx];
    if (!cuota || cuota.pagado) return;

    const hoy = new Date().toISOString().split('T')[0];
    cuota.pagado = true;
    cuota.fechaPago = hoy;
    cuota.metodoPago = plan.metodoPreferido || 'Efectivo';

    plan.cobrado = plan.cuotas.filter(c => c.pagado).reduce((acc, c) => acc + c.monto, 0);
    plan.saldo = Math.max(0, (plan.totalCuotas || 0) - plan.cobrado);
    if (plan.saldo === 0) plan.estado = 'completado';

    await api.actualizarPlanPago(plan.id, plan);

    if (plan.pagoId) {
      const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
      if (pagoAsociado) {
        await api.actualizarPago(pagoAsociado.id, {
          ...pagoAsociado,
          cobrado: plan.cobrado,
          saldo: plan.saldo,
          fechaUltPago: hoy,
          cuotas: plan.cuotas
        });
      }
    }

    cargarPlanPagos();
    cargarPagos();
    Swal.fire({ title: 'Cuota Pagada ✅', icon: 'success', background: '#1e293b', color: '#fff', timer: 1400, showConfirmButton: false });
  };

  const handleRevertirCuota = async (plan, idx) => {
    const confirm = await Swal.fire({
      title: '¿Revertir este pago?',
      text: "La cuota volverá a estar pendiente de cobro.",
      icon: 'warning',
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, revertir'
    });

    if (confirm.isConfirmed) {
      const cuota = plan.cuotas[idx];
      cuota.pagado = false;
      cuota.fechaPago = null;
      cuota.metodoPago = null;
      plan.estado = 'activo';

      plan.cobrado = plan.cuotas.filter(c => c.pagado).reduce((acc, c) => acc + c.monto, 0);
      plan.saldo = Math.max(0, (plan.totalCuotas || 0) - plan.cobrado);

      await api.actualizarPlanPago(plan.id, plan);

      if (plan.pagoId) {
        const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
        if (pagoAsociado) {
          await api.actualizarPago(pagoAsociado.id, {
            ...pagoAsociado,
            cobrado: plan.cobrado,
            saldo: plan.saldo,
            cuotas: plan.cuotas
          });
        }
      }

      cargarPlanPagos();
      cargarPagos();
      Swal.fire({ title: 'Cobro revertido', icon: 'warning', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleAgregarCuota = async (plan) => {
    const ultima = plan.cuotas[plan.cuotas.length - 1];
    const nFec = ultima && ultima.fecha 
      ? new Date(new Date(`${ultima.fecha}T12:00:00`).setDate(new Date(`${ultima.fecha}T12:00:00`).getDate() + 30)).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    plan.cuotas.push({
      num: 0,
      tipo: 'cuota',
      fecha: nFec,
      monto: 0,
      pagado: false,
      fechaPago: null,
      metodoPago: null
    });

    let cont = 1;
    plan.cuotas.forEach(q => { if (q.tipo !== 'anticipo') q.num = cont++; });
    reajustarCuotas(plan);

    await api.actualizarPlanPago(plan.id, plan);
    if (plan.pagoId) {
      const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
      if (pagoAsociado) await api.actualizarPago(pagoAsociado.id, { ...pagoAsociado, cuotas: plan.cuotas });
    }

    cargarPlanPagos();
    cargarPagos();
    Swal.fire({ title: 'Cuota añadida y saldos reajustados', icon: 'success', background: '#1e293b', color: '#fff', timer: 1600, showConfirmButton: false });
  };

  const handleQuitarCuota = async (plan, idx) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar esta cuota pendiente?',
      icon: 'warning',
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar'
    });

    if (confirm.isConfirmed) {
      plan.cuotas.splice(idx, 1);
      let cont = 1;
      plan.cuotas.forEach(q => { if (q.tipo !== 'anticipo') q.num = cont++; });
      reajustarCuotas(plan);

      await api.actualizarPlanPago(plan.id, plan);
      if (plan.pagoId) {
        const pagoAsociado = pagos.find(p => p.id === plan.pagoId);
        if (pagoAsociado) await api.actualizarPago(pagoAsociado.id, { ...pagoAsociado, cuotas: plan.cuotas });
      }

      cargarPlanPagos();
      cargarPagos();
      Swal.fire({ title: 'Cuota eliminada', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleCerrarPlan = async (plan) => {
    await api.actualizarPlanPago(plan.id, { ...plan, estado: 'completado' });
    cargarPlanPagos();
    Swal.fire({ title: 'Plan cerrado 🔒', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
  };

  const handleEliminarPlan = async (id) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar plan de pago?',
      text: "Se borrará este cronograma.",
      icon: 'warning',
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar'
    });

    if (confirm.isConfirmed) {
      await api.eliminarPlanPago(id);
      cargarPlanPagos();
      Swal.fire({ title: 'Eliminado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  const handleGuardarNuevoPP = async (payload) => {
    try {
      await api.crearPlanPago(payload);
      setModalPPAbierto(false);
      cargarPlanPagos();
      Swal.fire({ title: 'Plan de Pago Creado 🗓️', icon: 'success', background: '#1e293b', color: '#fff', timer: 1600, showConfirmButton: false });
    } catch (error) {
      console.error(error);
      Swal.fire({ title: 'Error', text: 'No se pudo crear el plan de pago.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  // ==========================================
  // NUEVO: FUNCIONES PARA PLANES DE TRATAMIENTO
  // ==========================================
  const handleNuevoPlan = () => {
    setPlanSeleccionado(null);
    setModalPlanAbierto(true);
  };

  const handleEditarPlan = (plan) => {
    setPlanSeleccionado(plan);
    setModalPlanAbierto(true);
  };

  const handleGuardarPlan = async (payload, id) => {
    try {
      if (id) {
        await api.actualizarPlan(id, payload);
        Swal.fire({ title: 'Plan Actualizado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
      } else {
        await api.crearPlan(payload);
        Swal.fire({ title: 'Plan Creado 🗂️', icon: 'success', background: '#1e293b', color: '#fff', timer: 1500, showConfirmButton: false });
      }
      setModalPlanAbierto(false);
      cargarPlanes();
    } catch (error) {
      console.error(error);
      Swal.fire({ title: 'Error', text: 'No se pudo guardar el plan de tratamiento.', icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const handleEliminarPlanTratamiento = async (id, nombre) => {
    const confirm = await Swal.fire({
      title: `¿Eliminar la carpeta "${nombre}"?`,
      text: "El historial clínico se desvinculará del plan.",
      icon: 'warning',
      showCancelButton: true,
      background: '#1e293b',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar'
    });

    if (confirm.isConfirmed) {
      await api.eliminarPlan(id);
      cargarPlanes();
      Swal.fire({ title: 'Plan eliminado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1200, showConfirmButton: false });
    }
  };

  // ==========================================
  // FILTRADO Y ORDENAMIENTO
  // ==========================================
  const pacientesFiltrados = pacientes
    .filter(p => {
      const q = busqueda.toLowerCase();
      const nom = (p.nombre || '').toLowerCase();
      const ced = (p.cedula || '').toLowerCase();
      const fic = (p.codigo_ficha || '').toLowerCase();
      return nom.includes(q) || ced.includes(q) || fic.includes(q);
    })
    .sort((a, b) => {
      const numA = parseInt((a.codigo_ficha || '').replace(/\D/g, ''), 10) || 999999;
      const numB = parseInt((b.codigo_ficha || '').replace(/\D/g, ''), 10) || 999999;
      if (numA !== numB) return numA - numB;
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

  const citasFiltradas = citas
    .map(c => {
      const pac = pacientes.find(p => p.id === c.pacienteId) || {};
      return {
        ...c,
        nombrePaciente: pac.nombre || 'Paciente no encontrado',
        cedulaPaciente: pac.cedula || '—',
        codigoFicha: pac.codigo_ficha || ''
      };
    })
    .filter(c => {
      const q = busquedaCita.toLowerCase();
      const coincideTexto = 
        c.nombrePaciente.toLowerCase().includes(q) || 
        (c.procedimiento || '').toLowerCase().includes(q) ||
        (c.cedulaPaciente || '').toLowerCase().includes(q);
      
      const coincideEstado = filtroEstadoCita === 'Todos' || c.estado === filtroEstadoCita.toLowerCase();
      return coincideTexto && coincideEstado;
    })
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.hora || '').localeCompare(a.hora || ''));

  const pagosFiltrados = pagos
    .map(g => {
      const pac = pacientes.find(p => p.id === g.pacienteId) || {};
      return {
        ...g,
        nombrePaciente: pac.nombre || 'Paciente no encontrado',
        cedulaPaciente: pac.cedula || '—',
        codigoFicha: pac.codigo_ficha || ''
      };
    })
    .filter(g => {
      const q = busquedaFinanzas.toLowerCase();
      return (
        g.nombrePaciente.toLowerCase().includes(q) ||
        (g.concepto || '').toLowerCase().includes(q) ||
        (g.metodo || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const planPagosFiltrados = planPagos
    .map(pl => {
      const pac = pacientes.find(p => p.id === pl.pacienteId) || {};
      return {
        ...pl,
        nombrePaciente: pac.nombre || 'Paciente no encontrado',
        telefonoPaciente: pac.telefono || '—',
        codigoFicha: pac.codigo_ficha || ''
      };
    })
    .filter(pl => {
      const q = busquedaPP.toLowerCase();
      return (
        pl.nombrePaciente.toLowerCase().includes(q) ||
        (pl.concepto || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));

  // Filtro de Planes de Tratamiento
  const planesFiltrados = planes
    .map(pl => {
      const pac = pacientes.find(p => p.id === pl.pacienteId) || {};
      return {
        ...pl,
        nombrePaciente: pac.nombre || 'Paciente no encontrado',
        telefonoPaciente: pac.telefono || '—',
        codigoFicha: pac.codigo_ficha || ''
      };
    })
    .filter(pl => {
      const q = busquedaPlan.toLowerCase();
      return (
        pl.nombrePaciente.toLowerCase().includes(q) ||
        (pl.nombre || '').toLowerCase().includes(q) ||
        (pl.tipo || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));

  // ==========================================
  // CÁLCULOS DEL DASHBOARD PRINCIPAL
  // ==========================================
  const hoyStr = new Date().toISOString().split('T')[0];
  const mananaDate = new Date();
  mananaDate.setDate(mananaDate.getDate() + 1);
  const mananaStr = mananaDate.toISOString().split('T')[0];

  const citasHoy = citasFiltradas.filter(c => c.fecha === hoyStr && c.estado !== 'cancelada');
  const citasManana = citasFiltradas.filter(c => c.fecha === mananaStr && c.estado !== 'cancelada');
  const citasEnAtencion = citasFiltradas.filter(c => c.estado === 'en_atencion');

  const pacientesConDeuda = pagos.filter(g => parseFloat(g.saldo || 0) > 0);
  const pacientesSinVisitaReciente = pacientes.filter(p => {
    const ultCita = citas
      .filter(c => c.pacienteId === p.id && c.estado === 'completada')
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];
    if (!ultCita || !ultCita.fecha) return true;
    const diasSinVenir = (new Date() - new Date(`${ultCita.fecha}T12:00:00`)) / (1000 * 60 * 60 * 24);
    return diasSinVenir > 180;
  });

  const getBadgeEstado = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'completada':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><CheckCircle size={13}/> Completada</span>;
      case 'en_atencion':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max animate-pulse"><Clock size={13}/> En Atención 🔴</span>;
      case 'cancelada':
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><XCircle size={13}/> Cancelada</span>;
      default:
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max"><AlertCircle size={13}/> Pendiente</span>;
    }
  };

  const getBadgeTipoPago = (tipo) => {
    const nombres = {
      contado: 'Contado',
      completo: 'Pagado',
      anticipo: 'Anticipo',
      cuotas: 'Cuotas',
      sesion: 'Plan',
      cortesia: 'Cortesía'
    };
    return (
      <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-md text-xs font-semibold">
        {nombres[(tipo || '').toLowerCase()] || tipo || 'Contado'}
      </span>
    );
  };

  return (
    <div className="flex bg-slate-900 min-h-screen text-slate-100 font-sans">
      
      {/* MENÚ LATERAL */}
      <Sidebar vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} />

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-8 overflow-y-auto bg-slate-900 dark:bg-slate-900 light:bg-slate-100 transition-colors duration-200">
        
        {/* BARRA SUPERIOR GENERAL */}
        <div className="max-w-6xl mx-auto flex justify-end items-center mb-4">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-white text-xs font-semibold shadow-md transition duration-200 cursor-pointer select-none"
            title="Cambiar tema visual"
          >
            {tema === 'dark' ? (
              <>
                <span>☀️</span>
                <span>Modo Claro</span>
              </>
            ) : (
              <>
                <span>🌙</span>
                <span>Modo Oscuro</span>
              </>
            )}
          </button>
        </div>

        <div className="max-w-6xl mx-auto">
          
          {/* ==============================================
              PANTALLA 0: DASHBOARD PRINCIPAL
          =============================================== */}
          {vistaActiva === 'dashboard' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Centro de Mando</h1>
                  <p className="text-sm text-slate-400 mt-1">
                    {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={handleNuevaCita}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition duration-200 cursor-pointer"
                >
                  <CalendarPlus size={18} />
                  Agendar Cita
                </button>
              </div>

              {/* TARJETAS SUPERIORES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div onClick={() => setVistaActiva('pacientes')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Pacientes Totales</div>
                  <div className="text-2xl font-bold text-white font-serif">{pacientes.length}</div>
                  <p className="text-xs text-cyan-400 mt-1">Directorio registrado</p>
                </div>

                <div onClick={() => setVistaActiva('citas')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Citas para Hoy</div>
                  <div className="text-2xl font-bold text-cyan-400 font-serif">{citasHoy.length}</div>
                  <p className="text-xs text-slate-400 mt-1">{citasEnAtencion.length} en sillón ahora</p>
                </div>

                <div onClick={() => setVistaActiva('finanzas')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Cuentas por Cobrar</div>
                  <div className="text-2xl font-bold text-rose-400 font-serif">{pacientesConDeuda.length}</div>
                  <p className="text-xs text-rose-400/80 mt-1">Pacientes con saldo</p>
                </div>

                <div onClick={() => setVistaActiva('pacientes')} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg cursor-pointer hover:border-cyan-500 transition">
                  <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Sin Visita (+6 Meses)</div>
                  <div className="text-2xl font-bold text-amber-400 font-serif">{pacientesSinVisitaReciente.length}</div>
                  <p className="text-xs text-amber-400/80 mt-1">Requieren seguimiento</p>
                </div>
              </div>

              {/* GRILLA PRINCIPAL DE 2 COLUMNAS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  
                  {/* PANEL: EN ATENCIÓN */}
                  <div className="bg-slate-800/80 border-2 border-rose-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                        Pacientes en Atención 🔴
                      </h3>
                      <span className="text-xs bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full font-semibold border border-rose-500/20">
                        {citasEnAtencion.length} en sillón
                      </span>
                    </div>

                    <div className="space-y-3">
                      {citasEnAtencion.length > 0 ? (
                        citasEnAtencion.map(c => (
                          <div key={c.id} className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-4 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-white text-base">{c.nombrePaciente}</div>
                              <div className="text-xs text-rose-300 font-medium mt-0.5">🩺 {c.procedimiento || 'Tratamiento en curso'}</div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <Clock size={12} /> Inicio: {c.hora || '09:00'}
                              </div>
                            </div>
                            <button
                              onClick={() => handleAbrirCompletar(c)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                            >
                              <CheckCircle size={15} />
                              Completar
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-700/50">
                          Ningún paciente en atención en este momento.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LISTA: CITAS DE HOY */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-cyan-400 flex items-center gap-2">
                        <CalendarIcon size={18} />
                        Agenda de Hoy
                      </h3>
                      <button 
                        onClick={() => setVistaActiva('citas')}
                        className="text-xs text-cyan-400 hover:underline font-medium cursor-pointer"
                      >
                        Ver todas →
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {citasHoy.length > 0 ? (
                        citasHoy.map(c => (
                          <div key={c.id} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between hover:border-cyan-500/50 transition">
                            <div className="flex items-center gap-3">
                              <div className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg text-center min-w-16">
                                <div className="text-xs font-bold">{c.hora || '—'}</div>
                              </div>
                              <div>
                                <div className="font-semibold text-white text-sm">{c.nombrePaciente}</div>
                                <div className="text-xs text-slate-400">{c.procedimiento || 'Consulta General'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getBadgeEstado(c.estado)}
                              {c.estado === 'pendiente' && (
                                <button
                                  onClick={() => handleCambiarEstadoCita(c, 'en_atencion')}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                                  title="Pasar a sillón dental"
                                >
                                  ▶ Atender
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-sm bg-slate-900/30 rounded-xl">
                          No hay más citas programadas para hoy.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                <div className="space-y-6">
                  {/* ALERTAS INTELIGENTES */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-base font-bold text-amber-400 flex items-center gap-2 mb-4">
                      <AlertTriangle size={18} />
                      Alertas Inteligentes
                    </h3>

                    <div className="space-y-3">
                      <div 
                        onClick={() => setVistaActiva('finanzas')}
                        className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-rose-500/15 transition"
                      >
                        <div>
                          <div className="font-bold text-rose-400 text-sm">Cobros Pendientes</div>
                          <div className="text-xs text-slate-300 mt-0.5">
                            {pacientesConDeuda.length} paciente{pacientesConDeuda.length !== 1 ? 's' : ''} con saldo por cobrar
                          </div>
                        </div>
                        <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          {pacientesConDeuda.length}
                        </span>
                      </div>

                      <div 
                        onClick={() => setVistaActiva('pacientes')}
                        className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-amber-500/15 transition"
                      >
                        <div>
                          <div className="font-bold text-amber-400 text-sm">Seguimiento Preventivo</div>
                          <div className="text-xs text-slate-300 mt-0.5">
                            {pacientesSinVisitaReciente.length} paciente{pacientesSinVisitaReciente.length !== 1 ? 's' : ''} sin consulta en +6 meses
                          </div>
                        </div>
                        <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          {pacientesSinVisitaReciente.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PREVISIÓN: CITAS DE MAÑANA */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                        <CalendarIcon size={18} className="text-slate-400" />
                        Citas para Mañana
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">
                        {new Date(mananaDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {citasManana.length > 0 ? (
                        citasManana.map(c => (
                          <div key={c.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-slate-700/60 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold">
                                {c.hora || '—'}
                              </div>
                              <div>
                                <div className="font-semibold text-white text-sm">{c.nombrePaciente}</div>
                                <div className="text-xs text-slate-400">{c.procedimiento || 'Consulta General'}</div>
                              </div>
                            </div>
                            {getBadgeEstado(c.estado)}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500 text-sm bg-slate-900/30 rounded-xl">
                          No hay citas agendadas para mañana.
                        </div>
                      )}
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
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Gestión de Pacientes</h1>
                  <p className="text-sm text-slate-400 mt-1">Directorio clínico y expedientes</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-sm font-semibold">
                    {pacientesFiltrados.length} Registros
                  </span>
                  <button
                    onClick={handleNuevoPaciente}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition duration-200 cursor-pointer"
                  >
                    <UserPlus size={18} />
                    Nuevo Paciente
                  </button>
                </div>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por Ficha, Nombre o DNI..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-cyan-500 outline-none transition text-sm shadow-sm"
                />
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Ficha</th>
                      <th className="p-4">Paciente</th>
                      <th className="p-4">DNI</th>
                      <th className="p-4">Teléfono</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {pacientesFiltrados.length > 0 ? (
                      pacientesFiltrados.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-700/40 transition">
                          <td className="p-4 font-bold text-cyan-400">
                            <span className="bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20">
                              {p.codigo_ficha || 'N/A'}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-white">{p.nombre}</td>
                          <td className="p-4 text-slate-300">{p.cedula || '—'}</td>
                          <td className="p-4 text-slate-300">{p.telefono || '—'}</td>
                          <td className="p-4 flex justify-center gap-2">
                            <button 
                              onClick={() => handleVerFicha(p)}
                              className="p-2 bg-slate-700/80 rounded-lg hover:bg-cyan-600 hover:text-white transition cursor-pointer" 
                              title="Ver Ficha e Historial"
                            >
                              📋
                            </button>
                            <button 
                              onClick={() => handleEditarPaciente(p)}
                              className="p-2 bg-slate-700/80 rounded-lg hover:bg-amber-600 hover:text-white transition cursor-pointer" 
                              title="Editar Paciente"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleEliminar(p.id, p.nombre)}
                              className="p-2 bg-slate-700/80 rounded-lg hover:bg-red-600 hover:text-white transition cursor-pointer" 
                              title="Eliminar Paciente"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-400">
                          No se encontraron pacientes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==============================================
              PANTALLA 2: AGENDA / CITAS
          =============================================== */}
          {vistaActiva === 'citas' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Agenda / Citas Clínicas</h1>
                  <p className="text-sm text-slate-400 mt-1">Control de horarios, consultas y tratamientos</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-sm font-semibold">
                    {citasFiltradas.length} Citas
                  </span>
                  <button
                    onClick={handleNuevaCita}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition duration-200 cursor-pointer"
                  >
                    <CalendarPlus size={18} />
                    Agendar Cita
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar cita por paciente, DNI o motivo..."
                    value={busquedaCita}
                    onChange={(e) => setBusquedaCita(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-cyan-500 outline-none transition text-sm shadow-sm"
                  />
                </div>

                <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-1 gap-1">
                  {['Todos', 'pendiente', 'en_atencion', 'completada', 'cancelada'].map((estado) => {
                    const label = {
                      Todos: 'Todos',
                      pendiente: 'Pendientes',
                      en_atencion: 'En Atención',
                      completada: 'Completadas',
                      cancelada: 'Canceladas'
                    }[estado];

                    return (
                      <button
                        key={estado}
                        onClick={() => setFiltroEstadoCita(estado)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          filtroEstadoCita === estado
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Fecha y Hora</th>
                      <th className="p-4">Paciente</th>
                      <th className="p-4">Tratamiento</th>
                      <th className="p-4">Sesión</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {citasFiltradas.length > 0 ? (
                      citasFiltradas.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-700/40 transition">
                          <td className="p-4 whitespace-nowrap">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <CalendarIcon size={14} className="text-cyan-400" />
                              {c.fecha || 'Sin fecha'}
                            </div>
                            <div className="text-xs text-cyan-400/80 font-medium mt-0.5 flex items-center gap-1">
                              <Clock size={12} />
                              {c.hora || '--:--'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-white">{c.nombrePaciente}</div>
                            <div className="text-xs text-slate-400">{c.cedulaPaciente !== '—' ? `DNI: ${c.cedulaPaciente}` : ''}</div>
                          </td>
                          <td className="p-4 text-slate-300">{c.procedimiento || 'Consulta General'}</td>
                          <td className="p-4 text-xs font-semibold text-purple-400">
                            {c.totalSesiones > 1 ? `Ses. ${c.sesionNum || 1}/${c.totalSesiones}` : 'Única'}
                          </td>
                          <td className="p-4">{getBadgeEstado(c.estado)}</td>
                          <td className="p-4 flex justify-center items-center gap-2">
                            {c.estado !== 'completada' && (
                              <button
                                onClick={() => handleAbrirCompletar(c)}
                                className="p-2 bg-slate-700/80 rounded-lg hover:bg-emerald-600 hover:text-white transition cursor-pointer text-slate-300"
                                title="Completar Atención y Notas"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            {c.estado !== 'cancelada' && c.estado !== 'completada' && (
                              <button
                                onClick={() => handleAbrirCancelar(c)}
                                className="p-2 bg-slate-700/80 rounded-lg hover:bg-rose-600 hover:text-white transition cursor-pointer text-slate-300"
                                title="Cancelar Cita"
                              >
                                <XCircle size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditarCita(c)}
                              className="p-2 bg-slate-700/80 rounded-lg hover:bg-amber-600 hover:text-white transition cursor-pointer text-slate-300"
                              title="Editar Cita"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleEliminarCita(c.id, c.nombrePaciente)}
                              className="p-2 bg-slate-700/80 rounded-lg hover:bg-red-600 hover:text-white transition cursor-pointer text-slate-300"
                              title="Eliminar Cita"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="p-12 text-center text-slate-400">
                          No hay citas que coincidan con el filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-sm font-semibold">
                  {pagosFiltrados.length} Movimientos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Total Cobrado</span>
                    <DollarSign size={18} className="text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 font-serif">
                    {fMon(totalCobrado)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Ingresos acumulados en S/.</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Ingresos del Mes</span>
                    <TrendingUp size={18} className="text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold text-cyan-400 font-serif">
                    {fMon(ingresosMes)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Mes actual ({mesActualStr})</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Financiado Activo</span>
                    <CreditCard size={18} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-400 font-serif">
                    {fMon(financiadoActivo)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Planes en cuotas vigentes</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    <span>Por Cobrar</span>
                    <AlertTriangle size={18} className="text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-rose-400 font-serif">
                    {fMon(porCobrarTotal)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Deuda total pendiente</p>
                </div>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar pago por paciente, tratamiento o método..."
                  value={busquedaFinanzas}
                  onChange={(e) => setBusquedaFinanzas(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-cyan-500 outline-none transition text-sm shadow-sm"
                />
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Paciente</th>
                      <th className="p-4">Tratamiento</th>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Cobrado</th>
                      <th className="p-4">Saldo</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4">Método</th>
                      <th className="p-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {pagosFiltrados.length > 0 ? (
                      pagosFiltrados.map((g) => {
                        const saldoPendiente = parseFloat(g.saldo || 0);
                        const cobradoReal = parseFloat(g.cobrado || 0);

                        return (
                          <tr key={g.id} className="hover:bg-slate-700/40 transition">
                            <td className="p-4">
                              <div className="font-semibold text-white">{g.nombrePaciente}</div>
                              <div className="text-xs text-slate-400">{g.cedulaPaciente !== '—' ? `DNI: ${g.cedulaPaciente}` : ''}</div>
                            </td>
                            <td className="p-4 font-medium text-slate-200 max-w-xs truncate" title={g.concepto}>
                              {g.concepto || 'Consulta General'}
                            </td>
                            <td className="p-4 text-slate-400 text-xs whitespace-nowrap">
                              {g.fecha || '—'}
                            </td>
                            <td className="p-4 font-serif text-slate-300">
                              {fMon(g.total)}
                            </td>
                            <td className="p-4 font-serif font-bold text-emerald-400">
                              {fMon(cobradoReal)}
                            </td>
                            <td className="p-4 font-serif font-bold">
                              {saldoPendiente > 0 ? (
                                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                  {fMon(saldoPendiente)}
                                </span>
                              ) : (
                                <span className="text-emerald-400">✓ Al día</span>
                              )}
                            </td>
                            <td className="p-4">
                              {getBadgeTipoPago(g.tipoPago)}
                            </td>
                            <td className="p-4 text-slate-300 text-xs">
                              {g.metodo || '—'}
                            </td>
                            <td className="p-4 text-center">
                              {saldoPendiente > 0 && (
                                <button
                                  onClick={() => handleCobrarSaldo(g, g.nombrePaciente)}
                                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                                  title="Abonar al saldo pendiente"
                                >
                                  💳 Cobrar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" className="p-12 text-center text-slate-400">
                          No se encontraron registros de pagos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==============================================
              PANTALLA 4: PLANES DE TRATAMIENTO (CARPETAS)
          =============================================== */}
          {vistaActiva === 'planes' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-purple-400">Planes de Tratamiento</h1>
                  <p className="text-sm text-slate-400 mt-1">Carpetas clínicas, especialidades y control de avance por sesión</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-4 py-1.5 rounded-full text-sm font-semibold">
                    {planesFiltrados.length} Planes
                  </span>
                  <button
                    onClick={handleNuevoPlan}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition duration-200 cursor-pointer"
                  >
                    <FolderPlus size={18} />
                    Nuevo Plan
                  </button>
                </div>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar plan por paciente o nombre del tratamiento..."
                  value={busquedaPlan}
                  onChange={(e) => setBusquedaPlan(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-purple-500 outline-none transition text-sm shadow-sm"
                />
              </div>

              <div className="space-y-6">
                {planesFiltrados.length > 0 ? (
                  planesFiltrados.map((pl) => {
                    const citasDelPlan = citas
                      .filter(c => c.planId === pl.id)
                      .sort((a, b) => {
                        const aComp = a.estado === 'completada' ? 1 : 0;
                        const bComp = b.estado === 'completada' ? 1 : 0;
                        if (aComp !== bComp) return aComp - bComp;
                        if (aComp === 1) return (b.fecha || '').localeCompare(a.fecha || '');
                        return (a.fecha || '').localeCompare(b.fecha || '');
                      });

                    return (
                      <div key={pl.id} className="bg-slate-800/80 border border-purple-500/20 rounded-2xl p-6 shadow-xl hover:border-purple-500/40 transition">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-slate-700/80 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-lg">
                              {(pl.nombrePaciente || '?').charAt(0)}
                            </div>
                            <div>
                              <div className="text-lg font-bold text-white leading-tight">
                                {pl.nombrePaciente} {pl.codigoFicha ? `[${pl.codigoFicha}]` : ''}
                              </div>
                              <div className="text-xs text-purple-400 font-medium mt-0.5">
                                {pl.telefonoPaciente || '—'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-center">
                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase">
                              {pl.estado || 'activo'}
                            </span>
                            <div className="text-right">
                              <div className="text-xs text-slate-400">Presupuesto</div>
                              <div className="text-xl font-serif font-bold text-white">
                                {fMon(pl.costo)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <h3 className="text-base font-bold text-white">{pl.nombre}</h3>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {pl.tipo} · {pl.duracion} {pl.nSesiones ? `· ${pl.nSesiones} sesiones proyectadas` : ''}
                          </div>
                          {pl.descripcion && (
                            <p className="text-xs text-slate-300 mt-2 bg-slate-900/40 p-3 rounded-xl border border-slate-700/50">
                              {pl.descripcion}
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 mb-5">
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            Historial Clínico de {citasDelPlan.length} Sesione{citasDelPlan.length !== 1 ? 's' : ''}
                          </div>

                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {citasDelPlan.length > 0 ? (
                              citasDelPlan.map((c) => {
                                const baseName = (c.procedimiento || '—').split(' — Sesión')[0];
                                const procFormateado = c.totalSesiones > 1 ? `${baseName} — Sesión ${c.sesionNum || 1}` : baseName;

                                return (
                                  <div key={c.id} className="flex justify-between items-start text-xs p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-cyan-400">{c.fecha || '—'}</span>
                                        <span className="text-white font-medium">{procFormateado}</span>
                                      </div>
                                      {c.notasFin && (
                                        <div className="text-slate-400 italic">📝 {c.notasFin}</div>
                                      )}
                                    </div>
                                    <div>{getBadgeEstado(c.estado)}</div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-center py-4 text-slate-500 text-xs">
                                No hay citas ni avances registrados en esta carpeta aún.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setCitaSeleccionada({
                                  pacienteId: pl.pacienteId,
                                  planId: pl.id,
                                  procedimiento: `${pl.nombre} — Sesión ${citasDelPlan.length + 1}`,
                                  costo: 0,
                                  tipoPago: 'sesion'
                                });
                                setModalCitaAbierto(true);
                              }}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition cursor-pointer"
                            >
                              📅 Agendar Sesión
                            </button>
                            <button
                              onClick={() => handleEditarPlan(pl)}
                              className="px-4 py-2 bg-slate-700 hover:bg-amber-600 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                            >
                              ✏️ Editar
                            </button>
                          </div>

                          <button
                            onClick={() => handleEliminarPlanTratamiento(pl.id, pl.nombre)}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer"
                          >
                            🗑 Eliminar Plan
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                    <p className="text-slate-400 font-medium">No hay carpetas de planes de tratamiento registradas.</p>
                    <p className="text-xs text-slate-500 mt-1">Haz clic en "Nuevo Plan" para abrir la primera carpeta clínica.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==============================================
              PANTALLA 5: PLANES DE PAGO EN CUOTAS
          =============================================== */}
          {vistaActiva === 'planpagos' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-cyan-400">Planes de Pago en Cuotas</h1>
                  <p className="text-sm text-slate-400 mt-1">Cronogramas de financiamiento, vencimientos y abonos por cuota</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-sm font-semibold">
                    {planPagosFiltrados.length} Planes
                  </span>
                  <button
                    onClick={() => setModalPPAbierto(true)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition duration-200 cursor-pointer"
                  >
                    <PlusCircle size={18} />
                    Nuevo Plan de Pago
                  </button>
                </div>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar plan de pago por paciente o concepto..."
                  value={busquedaPP}
                  onChange={(e) => setBusquedaPP(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:border-cyan-500 outline-none transition text-sm shadow-sm"
                />
              </div>

              <div className="space-y-6">
                {planPagosFiltrados.length > 0 ? (
                  planPagosFiltrados.map((pl) => {
                    const cuotas = pl.cuotas || [];
                    const cuotasPendientes = cuotas.filter(q => !q.pagado);
                    const cuotasPagadas = cuotas.filter(q => q.pagado);
                    const totalPagado = cuotasPagadas.reduce((acc, q) => acc + (parseFloat(q.monto) || 0), 0);
                    const totalPend = cuotasPendientes.reduce((acc, q) => acc + (parseFloat(q.monto) || 0), 0);
                    const totalCuotasNum = parseFloat(pl.totalAcordado || 0);
                    const porcentaje = totalCuotasNum > 0 ? Math.min(100, (totalPagado / totalCuotasNum) * 100).toFixed(1) : 0;
                    const vencidas = cuotasPendientes.filter(q => q.fecha && q.fecha < hoyStr).length;

                    return (
                      <div 
                        key={pl.id} 
                        className={`bg-slate-800/80 border rounded-2xl p-6 shadow-xl transition ${
                          pl.estado === 'activo' ? 'border-cyan-500/40' : 'border-slate-700/60 opacity-85'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-slate-700/80 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                              {(pl.nombrePaciente || '?').charAt(0)}
                            </div>
                            <div>
                              <div className="text-lg font-bold text-white leading-tight">
                                {pl.nombrePaciente} {pl.codigoFicha ? `[${pl.codigoFicha}]` : ''}
                              </div>
                              <div className="text-xs text-cyan-400 font-medium mt-0.5">
                                {pl.concepto || 'Financiamiento Odontológico'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              pl.estado === 'activo' 
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' 
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {pl.estado || 'activo'}
                            </span>
                            <div className="text-right">
                              <div className="text-xs text-slate-400">Total Acordado</div>
                              <div className="text-xl font-serif font-bold text-white">
                                {fMon(pl.totalAcordado)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mb-6">
                          <div className="flex justify-between items-center text-xs mb-2">
                            <span>
                              Pagado: <strong className="text-emerald-400 font-serif">{fMon(totalPagado)}</strong>
                            </span>
                            <span className="text-slate-400">
                              Progreso: <strong className="text-white">{porcentaje}%</strong>
                            </span>
                            <span>
                              Pendiente: <strong className={vencidas > 0 ? 'text-rose-400' : 'text-amber-400'}>{fMon(totalPend)}</strong>
                            </span>
                          </div>

                          <div className="w-full bg-slate-900/80 h-3 rounded-full overflow-hidden border border-slate-700">
                            <div 
                              className="bg-emerald-500 h-full transition-all duration-500" 
                              style={{ width: `${porcentaje}%` }}
                            ></div>
                          </div>

                          {vencidas > 0 && (
                            <div className="mt-2 text-xs text-rose-400 font-bold flex items-center gap-1.5">
                              <AlertTriangle size={14} />
                              ⚠️ {vencidas} cuota(s) vencida(s) y pendientes de cobro
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden mb-5">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 uppercase">
                                <th className="p-3">#</th>
                                <th className="p-3">Fecha Vencimiento</th>
                                <th className="p-3">Monto</th>
                                <th className="p-3">Estado</th>
                                <th className="p-3 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {cuotas.map((q, idx) => {
                                const vencida = !q.pagado && q.fecha && q.fecha < hoyStr;
                                return (
                                  <tr key={idx} className={`hover:bg-slate-800/40 transition ${vencida ? 'bg-rose-500/5' : ''}`}>
                                    <td className="p-3 font-bold">
                                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                                        q.tipo === 'anticipo' ? 'bg-amber-500/15 text-amber-400' : 'bg-cyan-500/15 text-cyan-400'
                                      }`}>
                                        {q.tipo === 'anticipo' ? 'Anticipo' : `#${q.num}`}
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-300">{q.fecha || '—'}</td>
                                    <td className="p-3 font-serif font-bold text-white">S/. {parseFloat(q.monto || 0).toFixed(2)}</td>
                                    <td className="p-3">
                                      {q.pagado ? (
                                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                          <CheckCircle size={13} /> Pagado el {q.fechaPago || '—'}
                                        </span>
                                      ) : vencida ? (
                                        <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse">
                                          ⚠️ Vencida
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">Pendiente</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right space-x-1.5">
                                      {!q.pagado ? (
                                        <>
                                          <button
                                            onClick={() => handlePagarCuota(pl, idx)}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold transition cursor-pointer"
                                            title="Registrar cobro de esta cuota"
                                          >
                                            💵 Pagar
                                          </button>
                                          <button
                                            onClick={() => handleQuitarCuota(pl, idx)}
                                            className="p-1 bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                            title="Eliminar cuota y recalcular saldos"
                                          >
                                            🗑️
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => handleRevertirCuota(pl, idx)}
                                          className="px-2 py-1 bg-slate-700 hover:bg-amber-600/80 text-slate-300 hover:text-white rounded font-semibold flex items-center gap-1 ml-auto transition cursor-pointer"
                                          title="Revertir este cobro"
                                        >
                                          <Undo2 size={12} /> Revertir
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAgregarCuota(pl)}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-cyan-600 text-slate-200 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <PlusCircle size={15} /> ＋ Añadir Cuota
                            </button>
                            {pl.estado === 'activo' && (
                              <button
                                onClick={() => handleCerrarPlan(pl)}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <Lock size={14} /> Cerrar Plan
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => handleEliminarPlan(pl.id)}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer"
                          >
                            🗑 Eliminar Plan
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 bg-slate-800/60 border border-slate-700/60 rounded-2xl">
                    <p className="text-slate-400 font-medium">No se encontraron planes de pago en cuotas.</p>
                    <p className="text-xs text-slate-500 mt-1">Haz clic en "Nuevo Plan de Pago" para crear el primer cronograma.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODALES EMERGENTES */}
      <PacienteModal
        key={pacienteSeleccionado ? pacienteSeleccionado.id : 'nuevo-paciente'}
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onSave={handleGuardarPaciente}
        pacienteEditar={pacienteSeleccionado}
      />

      <CitaModal
        key={citaSeleccionada ? citaSeleccionada.id : 'nueva-cita'}
        isOpen={modalCitaAbierto}
        onClose={() => setModalCitaAbierto(false)}
        onSave={handleGuardarCita}
        citaEditar={citaSeleccionada}
        pacientes={pacientes}
      />

      <CompletarCitaModal
        key={citaParaAccion ? `comp-${citaParaAccion.id}` : 'comp-modal'}
        isOpen={modalCompletarAbierto}
        onClose={() => setModalCompletarAbierto(false)}
        onSave={handleGuardarCompletado}
        cita={citaParaAccion}
        pago={pagoParaAccion}
      />

      <CancelarCitaModal
        key={citaParaAccion ? `canc-${citaParaAccion.id}` : 'canc-modal'}
        isOpen={modalCancelarAbierto}
        onClose={() => setModalCancelarAbierto(false)}
        onSave={handleGuardarCancelacion}
        cita={citaParaAccion}
        pago={pagoParaAccion}
      />

      <FichaPacienteModal
        isOpen={modalFichaAbierto}
        onClose={() => setModalFichaAbierto(false)}
        paciente={pacienteSeleccionado}
        citas={citas}
        pagos={pagos}
        onNuevaCita={() => {
          setCitaSeleccionada(null);
          setModalCitaAbierto(true);
        }}
        onEditarPaciente={handleEditarPaciente}
      />

      <PlanPagoModal
        isOpen={modalPPAbierto}
        onClose={() => setModalPPAbierto(false)}
        onSave={handleGuardarNuevoPP}
        pacientes={pacientes}
      />

      <PlanTratamientoModal
        key={planSeleccionado ? planSeleccionado.id : 'nuevo-plan'}
        isOpen={modalPlanAbierto}
        onClose={() => setModalPlanAbierto(false)}
        onSave={handleGuardarPlan}
        planEditar={planSeleccionado}
        pacientes={pacientes}
      />
    </div>
  );
}