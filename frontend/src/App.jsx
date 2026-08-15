import { crearAccionesCitas } from './app/actions/citas';
import { crearAccionesPacientes } from './app/actions/pacientes';
import { crearAccionesPlanesPago } from './app/actions/planesPago';
import { crearAccionesPlanesTratamiento } from './app/actions/planesTratamiento';
import AppModals from './app/components/AppModals';
import useDentalProData from './app/hooks/useDentalProData';
import {
  calcularResumenFinanzas,
  enriquecerCitas,
  enriquecerPagos,
  filtrarPacientes,
  filtrarPagos,
  filtrarPlanesPago,
  filtrarPlanesTratamiento
} from './app/selectores';
import {
  puedeAccederVista,
  resolverRutaApp,
  rutaDeVista,
  rutaPaciente
} from './app/rutas';
import FinanzasPage from './features/finanzas/components/FinanzasPage';
import PlanesPagoPage from './features/finanzas/components/PlanesPagoPage';
import PlanesTratamientoPage from './features/tratamientos/components/PlanesTratamientoPage';
import Sidebar from './shared/components/Sidebar';
import ThemeSelector from './shared/components/ThemeSelector';
import { normalizarTemaGuardado } from './shared/themeConfig';
import LoginPage from './features/autenticacion/components/LoginPage';
import CambiarContrasenaObligatoria from './features/autenticacion/components/CambiarContrasenaObligatoria';

import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from './services/api';
import { formatearMoneda } from './shared/utils/dentalPro';

import Swal from 'sweetalert2';
const Dashboard = lazy(
  () => import('./features/dashboard/components/Dashboard')
);


const PacientesPage = lazy(
  () => import('./features/pacientes/components/PacientesPage')
);

const AgendaClinicaProfesional = lazy(
  () =>
    import(
      './features/agenda/components/AgendaClinicaProfesional'
    )
);

const UsuariosPage = lazy(
  () => import('./features/usuarios/components/UsuariosPage')
);
const CatalogoServiciosPage = lazy(
  () => import('./features/catalogo/components/CatalogoServiciosPage')
);
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const rutaActual = resolverRutaApp(location.pathname);
  const vistaActiva = rutaActual.vista;
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);


  // ==========================================
  // ESTADO Y LÓGICA DE LAS CUATRO PALETAS VISUALES
  // ==========================================
  const [tema, setTema] = useState(() => {
    return normalizarTemaGuardado(localStorage.getItem('dp-theme'));
  });

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.setAttribute('data-theme', tema);
    raiz.classList.add('light');
    raiz.classList.remove('dark');
    localStorage.setItem('dp-theme', tema);
  }, [tema]);
  useEffect(() => {
    const bloquearRuedaEnMontos = (event) => {
      const entrada = event.target?.closest?.(
        'input[type="number"][data-money-input="true"]'
      );
      if (!entrada || document.activeElement !== entrada) return;
      event.preventDefault();
    };

    document.addEventListener('wheel', bloquearRuedaEnMontos, {
      capture: true,
      passive: false
    });
    return () => {
      document.removeEventListener('wheel', bloquearRuedaEnMontos, true);
    };
  }, []);
  useEffect(() => {
    let componenteActivo = true;

    api.obtenerSesion()
      .then((respuesta) => {
        if (componenteActivo) {
          setUsuarioActual(respuesta.usuario);
        }
      })
      .catch(() => {
        if (componenteActivo) {
          setUsuarioActual(null);
        }
      })
      .finally(() => {
        if (componenteActivo) {
          setVerificandoSesion(false);
        }
      });

    return () => {
      componenteActivo = false;
    };
  }, []);
  const {
    pacientes,
    citas,
    pagos,
    planPagos,
    planes,
    casosClinicos,
    serviciosCatalogo,
    cargarPacientes,
    cargarCitas,
    cargarPagos,
    cargarPlanPagos,
    cargarPlanes,
    cargarCasosClinicos,
    cargarServiciosCatalogo,
    limpiarDatos
  } = useDentalProData(usuarioActual);

  // ==========================================
  // ESTADOS DE PACIENTES
  // ==========================================
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [modalFichaAbierto, setModalFichaAbierto] = useState(false);

  useEffect(() => {
    if (
      !usuarioActual ||
      usuarioActual.debeCambiarContrasena ||
      puedeAccederVista(vistaActiva, usuarioActual.rol)
    ) {
      return;
    }
    navigate('/', { replace: true });
  }, [navigate, usuarioActual, vistaActiva]);

  useEffect(() => {
    if (!rutaActual.pacienteId) {
      setModalFichaAbierto(false);
      return;
    }
    if (!pacientes.length) return;
    const paciente = pacientes.find(
      (item) => Number(item.id) === Number(rutaActual.pacienteId)
    );
    if (!paciente) return;
    setPacienteSeleccionado(paciente);
    setModalFichaAbierto(true);
  }, [pacientes, rutaActual.pacienteId]);

  // ==========================================
  // ESTADOS DE CITAS & MODALES CLÍNICOS
  // ==========================================
  const [modalCitaAbierto, setModalCitaAbierto] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);

  const [modalCompletarAbierto, setModalCompletarAbierto] = useState(false);
  const [modalCancelarAbierto, setModalCancelarAbierto] = useState(false);
  const [citaParaAccion, setCitaParaAccion] = useState(null);
  const [pagoParaAccion, setPagoParaAccion] = useState(null);

  // ==========================================
  // ESTADOS DE FINANZAS / PAGOS & PLANES DE PAGO
  // ==========================================
  const [busquedaFinanzas, setBusquedaFinanzas] = useState('');
  const [filtroFinanzas, setFiltroFinanzas] = useState('todos');

  const handleCambiarVista = (vista) => {
    if (vista === 'finanzas') {
      setFiltroFinanzas('todos');
    }
    navigate(rutaDeVista(vista));
  };

  const handleVerCobrosPendientes = () => {
    setBusquedaFinanzas('');
    setFiltroFinanzas('pendientes');
    navigate(rutaDeVista('finanzas'));
  };

  const [busquedaPP, setBusquedaPP] = useState('');
  const [modalPPAbierto, setModalPPAbierto] = useState(false);
  const [planPagoContexto, setPlanPagoContexto] = useState(null);

  // ==========================================
  // NUEVO: ESTADOS PARA PLANES DE TRATAMIENTO
  // ==========================================
  const [busquedaPlan, setBusquedaPlan] = useState('');
  const [modalPlanAbierto, setModalPlanAbierto] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);

  const handleLogin = async ({
    nombreUsuario,
    contrasena
  }) => {
    const respuesta = await api.iniciarSesion(
      nombreUsuario,
      contrasena
    );

    setUsuarioActual(respuesta.usuario);
  };
  const handleCerrarSesion = async () => {
    try {
      await api.cerrarSesion();

      setUsuarioActual(null);
      navigate('/');
      limpiarDatos();
    } catch (error) {
      Swal.fire({
        title: 'No se pudo cerrar la sesión',
        text: error.message,
        icon: 'error',
        background: '#1e293b',
        color: '#fff'
      });
    }
  };

  if (verificandoSesion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          <p className="text-sm font-semibold text-slate-400">
            Verificando sesión…
          </p>
        </div>
      </main>
    );
  }

  if (!usuarioActual) {
    return (
      <LoginPage onLogin={handleLogin} />
    );
  }

  if (usuarioActual.debeCambiarContrasena) {
    return (
      <CambiarContrasenaObligatoria
        usuario={usuarioActual}
        onContrasenaCambiada={() => {
          setUsuarioActual(null);
          navigate('/');
        }}
      />
    );
  }
  const fMon = formatearMoneda;

  // ==========================================
  // CRUD PACIENTES
  // ==========================================
  const {
    handleVerFicha,
    handleImportarCSV,
    handleNuevoPaciente,
    handleEditarPaciente,
    handleGuardarPaciente,
    handleEliminar
  } = crearAccionesPacientes({
    pacientes,
    cargarPacientes,
    setPacienteSeleccionado,
    setModalFichaAbierto,
    setModalAbierto
  });

  const handleVerFichaConRuta = (paciente) => {
    handleVerFicha(paciente);
    navigate(rutaPaciente(paciente.id));
  };

  const {
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
  } = crearAccionesCitas({
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
    setVistaActiva: (vista) => navigate(rutaDeVista(vista)),
    setBusquedaPP,
    setCitaSeleccionada,
    setModalCitaAbierto,
    setPlanPagoContexto,
    setModalPPAbierto,
    setCitaParaAccion,
    setPagoParaAccion,
    setModalCompletarAbierto,
    setModalCancelarAbierto
  });

  const {
    handlePagarCuota,
    handleRegistrarAdelantoPlan,
    handleRevertirCuota,
    handleAgregarCuota,
    handleQuitarCuota,
    handleEliminarPlan,
    handleGuardarNuevoPP
  } = crearAccionesPlanesPago({
    usuarioActual,
    cargarPlanPagos,
    cargarPagos,
    cargarPlanes,
    fMon,
    setModalPPAbierto,
    setPlanPagoContexto
  });

  const {
    handleNuevoPlan,
    handleEditarPlan,
    handleGuardarPlan,
    handleEliminarPlanTratamiento
  } = crearAccionesPlanesTratamiento({
    cargarPlanes,
    cargarPagos,
    cargarCasosClinicos,
    setPlanSeleccionado,
    setModalPlanAbierto,
    setPlanPagoContexto,
    setModalPPAbierto
  });

  // ==========================================
  // FILTRADO Y ORDENAMIENTO
  // ==========================================
  const pacientesFiltrados = filtrarPacientes(pacientes, busqueda);
  const citasFiltradas = enriquecerCitas(citas, pacientes);
  const pagosConPaciente = enriquecerPagos(pagos, pacientes);
  const pagosFiltrados = filtrarPagos(
    pagosConPaciente,
    busquedaFinanzas,
    filtroFinanzas
  );
  const planPagosFiltrados = filtrarPlanesPago(
    planPagos,
    pacientes,
    busquedaPP
  );
  const planesFiltrados = filtrarPlanesTratamiento(
    planes,
    pacientes,
    busquedaPlan
  );
  const resumenFinanzas = calcularResumenFinanzas(pagos);

  return (
    <div className="dp-app-shell flex min-h-screen bg-slate-900 font-sans text-slate-100">
      <Sidebar
        vistaActiva={vistaActiva}
        setVistaActiva={handleCambiarVista}
        usuarioActual={usuarioActual}
        onCerrarSesion={handleCerrarSesion}
      />

      <main className="dp-main min-w-0 flex-1 overflow-y-auto bg-slate-900 p-4 transition-colors duration-200 sm:p-6 xl:p-8">

        {usuarioActual.entornoDatos === 'pruebas' && (
          <div className="mx-auto mb-4 flex max-w-[1800px] items-center justify-center rounded-xl border border-amber-500 bg-amber-950 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-amber-100 shadow-lg">
            Entorno de pruebas activo · Los cambios no afectan la base oficial
          </div>
        )}

        <div className="dp-theme-toolbar sticky top-0 z-30 mx-auto mb-4 flex max-w-[1800px] items-center justify-end py-1">
          <ThemeSelector tema={tema} onChange={setTema} />
        </div>

        <div className="mx-auto w-full max-w-[1800px]">

          {vistaActiva === 'dashboard' && (
  <Suspense
    fallback={
      <div className="flex min-h-64 items-center justify-center text-slate-500">
        Cargando panel principal...
      </div>
    }
  >
    <Dashboard
      pacientes={pacientes}
      citas={citasFiltradas}
      pagos={pagos}
      rolUsuario={usuarioActual.rol}
      onCambiarVista={handleCambiarVista}
      onVerCobrosPendientes={handleVerCobrosPendientes}
      onNuevaCita={handleNuevaCita}
      onAbrirCompletar={handleAbrirCompletar}
      onCambiarEstadoCita={handleCambiarEstadoCita}
    />
  </Suspense>
)}


          {/* ==============================================
              PANTALLA 1: PACIENTES
          =============================================== */}
          {/* ==============================================
    PANTALLA 1: PACIENTES
=============================================== */}
{vistaActiva === 'pacientes' && (
  <Suspense
    fallback={
      <div className="flex min-h-64 items-center justify-center text-slate-500">
        Cargando pacientes...
      </div>
    }
  >
    <PacientesPage
      pacientes={pacientesFiltrados}
      busqueda={busqueda}
      onCambiarBusqueda={setBusqueda}
      onExportar={() => api.exportarPacientes()}
      onImportar={handleImportarCSV}
      onNuevo={handleNuevoPaciente}
      onVerFicha={handleVerFichaConRuta}
      onEditar={handleEditarPaciente}
      onEliminar={handleEliminar}
    />
  </Suspense>
)}
          {/* ==============================================
              PANTALLA 2: AGENDA CLÍNICA PROFESIONAL
          =============================================== */}
          {vistaActiva === 'citas' && (
  <Suspense
    fallback={
      <div className="flex min-h-64 items-center justify-center text-slate-500">
        Cargando agenda clínica...
      </div>
    }
  >
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
      onVerFicha={handleVerFichaConRuta}
      onEliminarCita={handleEliminarCita}
      onReprogramarCita={handleReprogramarCita}
      onVerCuotas={handleVerCuotasDesdeAgenda}
    />
  </Suspense>
)}

          {/* ==============================================
              PANTALLA 3: FINANZAS Y PAGOS
          =============================================== */}
          {vistaActiva === 'finanzas' && (
            <FinanzasPage
              pagos={pagosConPaciente}
              pagosFiltrados={pagosFiltrados}
              busqueda={busquedaFinanzas}
              filtro={filtroFinanzas}
              resumen={resumenFinanzas}
              onCambiarBusqueda={setBusquedaFinanzas}
              onCambiarFiltro={setFiltroFinanzas}
              onCobrar={handleCobrarSaldo}
              formatearMoneda={fMon}
            />
          )}

          {/* ==============================================
              PANTALLA 4 Y 5: PLANES DE TRATAMIENTO Y PAGOS EN CUOTAS
          =============================================== */}
          {/* Se conservan igual, pero para no exceder el tamaño del código he simplificado la lógica visual de las tarjetas */}

          {vistaActiva === 'planes' && (
            <PlanesTratamientoPage
              planes={planesFiltrados}
              pagos={pagos}
              planesPago={planPagos}
              busqueda={busquedaPlan}
              onCambiarBusqueda={setBusquedaPlan}
              onNuevo={handleNuevoPlan}
              onEditar={handleEditarPlan}
              onEliminar={handleEliminarPlanTratamiento}
              onPagarCuota={handlePagarCuota}
              onAgendarSesion={(plan, sesion) => {
                setCitaSeleccionada({
                  pacienteId: plan.pacienteId,
                  casoClinicoId: plan.casoClinicoId,
                  planId: plan.id,
                  sesionPlanId: sesion?.id,
                  tipoCita: 'sesion_tratamiento',
                  procedimiento: sesion?.titulo || plan.nombre,
                  costo: 0,
                  tipoPago: 'sesion'
                });
                setModalCitaAbierto(true);
              }}
              onCrearCuotas={(plan, pago, sesiones) => {
                setPlanPagoContexto({
                  pacienteId: plan.pacienteId,
                  pagoId: pago?.id,
                  planId: plan.id,
                  casoClinicoId: plan.casoClinicoId,
                  concepto: plan.nombre,
                  totalAcordado: pago?.total ?? plan.costo,
                  cobrado: pago?.cobrado || 0,
                  nSesiones: plan.nSesiones,
                  sesiones,
                  origen: 'plan_tratamiento'
                });
                setModalPPAbierto(true);
              }}
              formatearMoneda={fMon}
            />
          )}

          {vistaActiva === 'planpagos' && (
            <PlanesPagoPage
              planesPago={planPagosFiltrados}
              citas={citas}
              planesTratamiento={planes}
              busqueda={busquedaPP}
              onCambiarBusqueda={setBusquedaPP}
              onNuevo={() => {
                setPlanPagoContexto(null);
                setModalPPAbierto(true);
              }}
              onEditar={(plan) => {
                const planClinico = planes.find(
                  (item) => Number(item.id) === Number(plan.planId)
                );
                setPlanPagoContexto({
                  ...plan,
                  sesiones: planClinico?.sesiones || []
                });
                setModalPPAbierto(true);
              }}
              onEditarCita={handleEditarCita}
              onPagarCuota={handlePagarCuota}
              onQuitarCuota={handleQuitarCuota}
              onRevertirCuota={handleRevertirCuota}
              onAgregarCuota={handleAgregarCuota}
              onRegistrarAdelanto={handleRegistrarAdelantoPlan}
              onEliminar={handleEliminarPlan}
              formatearMoneda={fMon}
            />
          )}

          {vistaActiva === 'usuarios' && usuarioActual.rol === 'administrador' && (
            <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-slate-500">Cargando usuarios...</div>}>
              <UsuariosPage usuarioActual={usuarioActual} />
            </Suspense>
          )}

          {vistaActiva === 'catalogo' && usuarioActual.rol === 'administrador' && (
            <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-slate-500">Cargando catálogo…</div>}>
              <CatalogoServiciosPage
                servicios={serviciosCatalogo}
                onRecargar={cargarServiciosCatalogo}
              />
            </Suspense>
          )}

        </div>
      </main>

      <AppModals
        modales={{
          modalPacienteAbierto: modalAbierto,
          modalFichaAbierto,
          modalCitaAbierto,
          modalCompletarAbierto,
          modalCancelarAbierto,
          modalPlanPagoAbierto: modalPPAbierto,
          modalPlanAbierto,
          pacienteSeleccionado,
          citaSeleccionada,
          citaParaAccion,
          pagoParaAccion,
          planPagoContexto,
          planSeleccionado
        }}
        datos={{
          pacientes,
          citas,
          pagos,
          planes,
          casosClinicos,
          serviciosCatalogo,
          planesPago: planPagos
        }}
        cargas={{
          citas: cargarCitas,
          pagos: cargarPagos,
          planesPago: cargarPlanPagos,
          planes: cargarPlanes,
          casosClinicos: cargarCasosClinicos
        }}
        acciones={{
          cerrarPaciente: () => setModalAbierto(false),
          guardarPaciente: handleGuardarPaciente,
          cerrarCita: () => {
            setModalCitaAbierto(false);
            setCitaSeleccionada(null);
          },
          guardarCita: handleGuardarCita,
          cerrarCompletar: () => setModalCompletarAbierto(false),
          guardarCompletado: handleGuardarCompletado,
          cerrarCancelar: () => setModalCancelarAbierto(false),
          guardarCancelacion: handleGuardarCancelacion,
          cerrarFicha: () => {
            setModalFichaAbierto(false);
            if (rutaActual.pacienteId) {
              navigate(rutaDeVista('pacientes'), { replace: true });
            }
          },
          crearPlanDesdeFicha: (paciente, caso = null) => {
            setPlanSeleccionado({
              pacienteId: paciente?.id || null,
              casoClinicoId: caso?.id || null
            });
            setModalPlanAbierto(true);
          },
          verPlanPagosDesdeFicha: (paciente) => {
            setBusquedaPP(paciente?.nombre || '');
            navigate(rutaDeVista('planpagos'));
            setModalFichaAbierto(false);
          },
          nuevaCitaDesdeFicha: (paciente, datosIniciales = {}) => {
            setCitaSeleccionada({
              pacienteId: paciente?.id || null,
              ...datosIniciales
            });
            setModalCitaAbierto(true);
          },
          editarPaciente: handleEditarPaciente,
          cerrarPlanPago: () => {
            setModalPPAbierto(false);
            setPlanPagoContexto(null);
          },
          guardarPlanPago: handleGuardarNuevoPP,
          cerrarPlan: () => {
            setModalPlanAbierto(false);
            setPlanSeleccionado(null);
          },
          guardarPlan: handleGuardarPlan
        }}
      />
    </div>
  );
}
