import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Edit3,
  FileText,
  Filter,
  Hourglass,
  LayoutList,
  ListChecks,
  Phone,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  WalletCards,
  X,
  XCircle
} from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales
});

const ESTADOS = {
  pendiente: {
    etiqueta: 'Pendiente',
    clase: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    colorCalendario: '#f59e0b'
  },
  confirmada: {
    etiqueta: 'Confirmada',
    clase: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    colorCalendario: '#3b82f6'
  },
  en_espera: {
    etiqueta: 'En espera',
    clase: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    colorCalendario: '#8b5cf6'
  },
  en_atencion: {
    etiqueta: 'En atención',
    clase: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    colorCalendario: '#f43f5e'
  },
  completada: {
    etiqueta: 'Atendida',
    clase: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    colorCalendario: '#10b981'
  },
  no_asistio: {
    etiqueta: 'No asistió',
    clase: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    colorCalendario: '#ea580c'
  },
  cancelada: {
    etiqueta: 'Cancelada',
    clase: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    colorCalendario: '#475569'
  }
};

const ESTADOS_ACTIVOS = new Set([
  'pendiente',
  'confirmada',
  'en_espera',
  'en_atencion'
]);

const ORDEN_ACTIVOS = {
  en_atencion: 0,
  en_espera: 1,
  confirmada: 2,
  pendiente: 3
};

const FILTROS_ESTADO = [
  ['todos', 'Todas'],
  ['pendiente', 'Pendientes'],
  ['confirmada', 'Confirmadas'],
  ['en_espera', 'En espera'],
  ['en_atencion', 'En atención'],
  ['completada', 'Atendidas'],
  ['no_asistio', 'No asistió'],
  ['cancelada', 'Canceladas']
];

const fechaLocal = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sumarDias = (fecha, dias) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
};

const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin fecha';
  const [year, month, day] = fecha.split('-').map(Number);
  if (!year || !month || !day) return fecha;

  const date = new Date(year, month - 1, day);
  const hoy = fechaLocal();
  const manana = fechaLocal(sumarDias(new Date(), 1));

  if (fecha === hoy) return 'Hoy';
  if (fecha === manana) return 'Mañana';

  return date.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const moneda = (valor) =>
  `S/. ${Number(valor || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

function BadgeEstado({ estado }) {
  const info = ESTADOS[estado] || ESTADOS.pendiente;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${info.clase}`}
    >
      {estado === 'en_atencion' && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
      )}
      {info.etiqueta}
    </span>
  );
}

function BotonAccion({
  children,
  onClick,
  title,
  variante = 'neutral',
  disabled = false
}) {
  const variantes = {
    neutral:
      'border-slate-600 bg-slate-700/70 text-slate-200 hover:border-slate-500 hover:bg-slate-700',
    info:
      'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
    primary:
      'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
    warning:
      'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
    purple:
      'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',
    success:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
    danger:
      'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
    orange:
      'border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
  };

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${variantes[variante]}`}
    >
      {children}
    </button>
  );
}

function ResumenCard({ titulo, valor, icono, detalle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 text-left shadow-lg transition hover:border-cyan-500/50 hover:bg-slate-800"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {titulo}
        </span>
        <span className="text-slate-400">{icono}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{valor}</div>
      <div className="mt-1 text-xs text-slate-500">{detalle}</div>
    </button>
  );
}

export default function AgendaClinicaProfesional({
  citas = [],
  pacientes = [],
  pagos = [],
  onNuevaCita,
  onEditarCita,
  onCambiarEstado,
  onCompletarCita,
  onCancelarCita,
  onCobrar,
  onVerFicha,
  onEliminarCita,
  onRecargar
}) {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [rangoFecha, setRangoFecha] = useState('todas');
  const [fechaExacta, setFechaExacta] = useState('');
  const [modoVista, setModoVista] = useState('lista');
  const [limiteVisible, setLimiteVisible] = useState(20);

  useEffect(() => {
    setLimiteVisible(20);
  }, [busqueda, estadoFiltro, rangoFecha, fechaExacta]);

  const pacientesPorId = useMemo(
    () => new Map(pacientes.map((paciente) => [Number(paciente.id), paciente])),
    [pacientes]
  );

  const pagosPorCita = useMemo(() => {
    const mapa = new Map();
    pagos.forEach((pago) => {
      const citaId = Number(pago.citaId);
      if (!Number.isNaN(citaId) && !mapa.has(citaId)) {
        mapa.set(citaId, pago);
      }
    });
    return mapa;
  }, [pagos]);

  const citasEnriquecidas = useMemo(
    () =>
      citas.map((cita) => {
        const paciente = pacientesPorId.get(Number(cita.pacienteId)) || {};
        const pago = pagosPorCita.get(Number(cita.id)) || null;

        return {
          ...cita,
          paciente,
          pago,
          nombrePaciente: paciente.nombre || 'Paciente no encontrado',
          cedulaPaciente: paciente.cedula || '',
          codigoFicha: paciente.codigo_ficha || '',
          telefonoPaciente: paciente.telefono || '',
          correoPaciente: paciente.correo || ''
        };
      }),
    [citas, pacientesPorId, pagosPorCita]
  );

  const hoy = fechaLocal();
  const manana = fechaLocal(sumarDias(new Date(), 1));
  const finSemana = fechaLocal(sumarDias(new Date(), 7));

  const citasFiltradas = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);

    const coincideRango = (cita) => {
      if (fechaExacta) return cita.fecha === fechaExacta;
      if (rangoFecha === 'hoy') return cita.fecha === hoy;
      if (rangoFecha === 'manana') return cita.fecha === manana;
      if (rangoFecha === 'proximos7') {
        return cita.fecha >= hoy && cita.fecha <= finSemana;
      }
      if (rangoFecha === 'vencidas') {
        return cita.fecha < hoy && ESTADOS_ACTIVOS.has(cita.estado);
      }
      return true;
    };

    const resultado = citasEnriquecidas.filter((cita) => {
      const coincideEstado =
        estadoFiltro === 'todos' || cita.estado === estadoFiltro;

      if (!coincideEstado || !coincideRango(cita)) return false;

      if (!terminos.length) return true;

      const texto = normalizar(
        [
          cita.nombrePaciente,
          cita.cedulaPaciente,
          cita.codigoFicha,
          cita.telefonoPaciente,
          cita.correoPaciente,
          cita.procedimiento,
          cita.notas,
          cita.fecha,
          cita.hora
        ].join(' ')
      );

      return terminos.every((termino) => texto.includes(termino));
    });

    return resultado.sort((a, b) => {
      const aActivo = ESTADOS_ACTIVOS.has(a.estado);
      const bActivo = ESTADOS_ACTIVOS.has(b.estado);

      if (aActivo && !bActivo) return -1;
      if (!aActivo && bActivo) return 1;

      if (aActivo && bActivo) {
        const prioridadA = ORDEN_ACTIVOS[a.estado] ?? 9;
        const prioridadB = ORDEN_ACTIVOS[b.estado] ?? 9;
        if (prioridadA !== prioridadB) return prioridadA - prioridadB;

        return `${a.fecha || ''}${a.hora || ''}`.localeCompare(
          `${b.fecha || ''}${b.hora || ''}`
        );
      }

      return `${b.fecha || ''}${b.hora || ''}`.localeCompare(
        `${a.fecha || ''}${a.hora || ''}`
      );
    });
  }, [
    busqueda,
    citasEnriquecidas,
    estadoFiltro,
    fechaExacta,
    finSemana,
    hoy,
    manana,
    rangoFecha
  ]);

  const resumen = useMemo(() => {
    const citasHoy = citasEnriquecidas.filter(
      (cita) => cita.fecha === hoy && cita.estado !== 'cancelada'
    );

    return {
      hoy: citasHoy.length,
      pendientes: citasHoy.filter((cita) => cita.estado === 'pendiente').length,
      espera: citasHoy.filter((cita) => cita.estado === 'en_espera').length,
      atencion: citasEnriquecidas.filter(
        (cita) => cita.estado === 'en_atencion'
      ).length,
      vencidas: citasEnriquecidas.filter(
        (cita) => cita.fecha < hoy && ESTADOS_ACTIVOS.has(cita.estado)
      ).length
    };
  }, [citasEnriquecidas, hoy]);

  const eventosCalendario = useMemo(
    () =>
      citasFiltradas.map((cita) => {
        const fechaBase = cita.fecha || hoy;
        const horaBase = cita.hora || '09:00';
        const [year, month, day] = fechaBase.split('-').map(Number);
        const [hour, minute] = horaBase.split(':').map(Number);
        const start = new Date(year, month - 1, day, hour || 0, minute || 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        return {
          id: cita.id,
          title: `${cita.nombrePaciente} · ${cita.procedimiento || 'Consulta'}`,
          start,
          end,
          estado: cita.estado,
          citaData: cita
        };
      }),
    [citasFiltradas, hoy]
  );

  const aplicarFiltroRapido = (estado, rango = 'todas') => {
    setEstadoFiltro(estado);
    setRangoFecha(rango);
    setFechaExacta('');
    setModoVista('lista');
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setEstadoFiltro('todos');
    setRangoFecha('todas');
    setFechaExacta('');
  };

  const hayFiltros =
    Boolean(busqueda) ||
    estadoFiltro !== 'todos' ||
    rangoFecha !== 'todas' ||
    Boolean(fechaExacta);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            Agenda clínica y atención
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Busca por nombre, DNI, número de ficha, teléfono o procedimiento y
            gestiona cada etapa de la atención desde una sola pantalla.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRecargar}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
          >
            <RefreshCw size={17} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={() => onNuevaCita?.(null)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500"
          >
            <Plus size={18} />
            Agendar cita
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ResumenCard
          titulo="Citas hoy"
          valor={resumen.hoy}
          detalle="Programadas para la fecha"
          icono={<CalendarCheck2 size={19} />}
          onClick={() => aplicarFiltroRapido('todos', 'hoy')}
        />
        <ResumenCard
          titulo="Pendientes"
          valor={resumen.pendientes}
          detalle="Aún no confirmadas"
          icono={<Hourglass size={19} />}
          onClick={() => aplicarFiltroRapido('pendiente', 'hoy')}
        />
        <ResumenCard
          titulo="En espera"
          valor={resumen.espera}
          detalle="Pacientes que ya llegaron"
          icono={<UserRoundCheck size={19} />}
          onClick={() => aplicarFiltroRapido('en_espera', 'hoy')}
        />
        <ResumenCard
          titulo="En atención"
          valor={resumen.atencion}
          detalle="Atenciones abiertas"
          icono={<PlayCircle size={19} />}
          onClick={() => aplicarFiltroRapido('en_atencion')}
        />
        <ResumenCard
          titulo="Vencidas"
          valor={resumen.vencidas}
          detalle="Requieren seguimiento"
          icono={<Clock3 size={19} />}
          onClick={() => aplicarFiltroRapido('todos', 'vencidas')}
        />
      </div>

      <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 shadow-xl">
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_190px_190px_auto]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre, DNI, ficha, teléfono o procedimiento..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-11 pr-10 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-700 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="relative">
            <Filter
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <select
              value={rangoFecha}
              onChange={(event) => {
                setRangoFecha(event.target.value);
                setFechaExacta('');
              }}
              className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 py-3 pl-9 pr-9 text-sm text-white outline-none focus:border-cyan-500"
            >
              <option value="todas">Todas las fechas</option>
              <option value="hoy">Hoy</option>
              <option value="manana">Mañana</option>
              <option value="proximos7">Próximos 7 días</option>
              <option value="vencidas">Citas vencidas</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
          </div>

          <input
            type="date"
            value={fechaExacta}
            onChange={(event) => {
              setFechaExacta(event.target.value);
              if (event.target.value) setRangoFecha('todas');
            }}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
          />

          <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setModoVista('lista')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                modoVista === 'lista'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutList size={16} /> Lista
            </button>
            <button
              type="button"
              onClick={() => setModoVista('calendario')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                modoVista === 'calendario'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays size={16} /> Calendario
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTROS_ESTADO.map(([valor, etiqueta]) => (
            <button
              type="button"
              key={valor}
              onClick={() => setEstadoFiltro(valor)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                estadoFiltro === valor
                  ? 'border-cyan-500 bg-cyan-600 text-white'
                  : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-white'
              }`}
            >
              {etiqueta}
            </button>
          ))}

          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-700 hover:text-white"
            >
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {modoVista === 'calendario' ? (
        <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 shadow-xl">
          <div style={{ height: '72vh' }}>
            <Calendar
              localizer={localizer}
              culture="es"
              defaultView="week"
              views={['month', 'week', 'day', 'agenda']}
              events={eventosCalendario}
              messages={{
                next: 'Sig. ❯',
                previous: '❮ Ant.',
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                agenda: 'Lista',
                date: 'Fecha',
                time: 'Hora',
                event: 'Paciente / tratamiento',
                noEventsInRange: 'No hay citas en este rango.'
              }}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor:
                    ESTADOS[event.estado]?.colorCalendario || '#475569',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  display: 'block',
                  fontSize: '12px',
                  padding: '3px 6px',
                  fontWeight: '600',
                  boxShadow: '0 2px 5px rgba(0,0,0,.18)'
                }
              })}
              selectable
              onSelectEvent={(event) => onEditarCita?.(event.citaData)}
              onSelectSlot={(slotInfo) => {
                const fecha = format(slotInfo.start, 'yyyy-MM-dd');
                const hora = format(slotInfo.start, 'HH:mm');
                onNuevaCita?.({
                  fecha,
                  hora: hora === '00:00' ? '09:00' : hora
                });
              }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <ListChecks size={17} />
              <span>
                <strong className="text-white">{citasFiltradas.length}</strong>{' '}
                resultado{citasFiltradas.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {citasFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 px-6 py-14 text-center">
              <CalendarDays className="mx-auto text-slate-600" size={42} />
              <h3 className="mt-4 font-semibold text-slate-300">
                No se encontraron citas
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Cambia los filtros o agenda una nueva cita.
              </p>
              <button
                type="button"
                onClick={() => onNuevaCita?.(null)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                <Plus size={17} /> Agendar cita
              </button>
            </div>
          ) : (
            citasFiltradas.slice(0, limiteVisible).map((cita) => {
              const estado = cita.estado || 'pendiente';
              const pago = cita.pago;
              const saldo = Number(pago?.saldo || 0);
              const cobrado = Number(pago?.cobrado || 0);
              const costo = Number(pago?.total ?? cita.costo ?? 0);
              const activa = ESTADOS_ACTIVOS.has(estado);
              const vencida = cita.fecha < hoy && activa;
              const esSesion = Number(cita.totalSesiones || 1) > 1;
              const puedeEliminar =
                cobrado <= 0 &&
                ['pendiente', 'cancelada', 'no_asistio'].includes(estado);

              return (
                <article
                  key={cita.id}
                  className={`rounded-2xl border bg-slate-800/80 p-4 shadow-lg transition hover:bg-slate-800 ${
                    estado === 'en_atencion'
                      ? 'border-rose-500/50 shadow-rose-950/20'
                      : vencida
                        ? 'border-orange-500/40'
                        : 'border-slate-700/80 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                    <div className="flex min-w-[118px] items-center gap-3 xl:flex-col xl:items-start xl:gap-1">
                      <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center">
                        <div className="text-base font-bold text-cyan-300">
                          {cita.hora || '—'}
                        </div>
                        <div className="text-[11px] font-medium capitalize text-slate-400">
                          {formatearFecha(cita.fecha)}
                        </div>
                      </div>
                      {vencida && (
                        <span className="text-[11px] font-semibold text-orange-300">
                          Requiere seguimiento
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onVerFicha?.(cita.paciente)}
                          className="truncate text-left text-base font-bold text-white hover:text-cyan-300 hover:underline"
                        >
                          {cita.nombrePaciente}
                        </button>
                        <BadgeEstado estado={estado} />
                        {esSesion && (
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-300">
                            Sesión {cita.sesionNum || 1}/{cita.totalSesiones}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <FileText size={13} />
                          Ficha: <strong className="text-slate-300">{cita.codigoFicha || '—'}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserRound size={13} />
                          DNI: <strong className="text-slate-300">{cita.cedulaPaciente || '—'}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone size={13} />
                          {cita.telefonoPaciente || 'Sin teléfono'}
                        </span>
                      </div>

                      <div className="mt-3 text-sm font-semibold text-cyan-100">
                        🩺 {cita.procedimiento || 'Consulta'}
                      </div>

                      {cita.notas && (
                        <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                          📝 {cita.notas}
                        </div>
                      )}
                    </div>

                    <div className="min-w-[190px] rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Total</span>
                        <strong className="text-slate-200">{moneda(costo)}</strong>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Cobrado</span>
                        <strong className="text-emerald-300">{moneda(cobrado)}</strong>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Saldo</span>
                        <strong className={saldo > 0 ? 'text-rose-300' : 'text-emerald-300'}>
                          {moneda(saldo)}
                        </strong>
                      </div>
                      {!pago && Number(cita.costo || 0) > 0 && (
                        <div className="mt-2 text-[11px] text-amber-300">
                          ⚠️ Sin registro financiero asociado
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-700/70 pt-3">
                    {estado === 'pendiente' && (
                      <BotonAccion
                        variante="primary"
                        title="Confirmar asistencia"
                        onClick={() => onCambiarEstado?.(cita, 'confirmada')}
                      >
                        <BadgeCheck size={15} /> Confirmar
                      </BotonAccion>
                    )}

                    {['pendiente', 'confirmada'].includes(estado) && (
                      <BotonAccion
                        variante="purple"
                        title="El paciente ya llegó y está esperando"
                        onClick={() => onCambiarEstado?.(cita, 'en_espera')}
                      >
                        <Hourglass size={15} /> En espera
                      </BotonAccion>
                    )}

                    {['pendiente', 'confirmada', 'en_espera'].includes(estado) && (
                      <BotonAccion
                        variante="warning"
                        title="Iniciar atención clínica"
                        onClick={() => onCambiarEstado?.(cita, 'en_atencion')}
                      >
                        <PlayCircle size={15} /> Atender
                      </BotonAccion>
                    )}

                    {estado === 'en_atencion' && (
                      <BotonAccion
                        variante="success"
                        title="Finalizar la atención"
                        onClick={() => onCompletarCita?.(cita)}
                      >
                        <CheckCircle2 size={15} /> Completar
                      </BotonAccion>
                    )}

                    {estado === 'completada' && saldo > 0 && pago && (
                      <BotonAccion
                        variante="info"
                        title="Registrar un cobro"
                        onClick={() => onCobrar?.(pago, cita.nombrePaciente)}
                      >
                        <CircleDollarSign size={15} /> Cobrar
                      </BotonAccion>
                    )}

                    {activa && estado !== 'en_atencion' && (
                      <BotonAccion
                        variante="neutral"
                        title="Editar fecha, hora, tratamiento o pago"
                        onClick={() => onEditarCita?.(cita)}
                      >
                        <Edit3 size={15} /> Editar
                      </BotonAccion>
                    )}

                    {['pendiente', 'confirmada', 'en_espera'].includes(estado) && (
                      <BotonAccion
                        variante="orange"
                        title="Registrar que el paciente no asistió"
                        onClick={() => onCambiarEstado?.(cita, 'no_asistio')}
                      >
                        <UserRoundX size={15} /> No asistió
                      </BotonAccion>
                    )}

                    {activa && (
                      <BotonAccion
                        variante="danger"
                        title="Cancelar la cita"
                        onClick={() => onCancelarCita?.(cita)}
                      >
                        <XCircle size={15} /> Cancelar
                      </BotonAccion>
                    )}

                    <BotonAccion
                      variante="neutral"
                      title="Abrir ficha clínica"
                      onClick={() => onVerFicha?.(cita.paciente)}
                    >
                      <UserRound size={15} /> Ver ficha
                    </BotonAccion>

                    {puedeEliminar && (
                      <BotonAccion
                        variante="danger"
                        title="Eliminar definitivamente la cita y su registro financiero"
                        onClick={() =>
                          onEliminarCita?.(cita.id, cita.nombrePaciente)
                        }
                      >
                        <Trash2 size={15} /> Eliminar
                      </BotonAccion>
                    )}

                    <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                      {pago?.tipoPago === 'cuotas' ? (
                        <WalletCards size={15} />
                      ) : (
                        <CircleDollarSign size={15} />
                      )}
                      {pago?.tipoPago || cita.tipoPago || 'contado'}
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {citasFiltradas.length > limiteVisible && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setLimiteVisible((actual) => actual + 20)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
              >
                Mostrar 20 citas más
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
