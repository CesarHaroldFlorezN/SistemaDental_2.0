import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Filter,
  GripVertical,
  Hourglass,
  LayoutDashboard,
  LayoutList,
  ListChecks,
  MoreHorizontal,
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
    corta: 'Programada',
    clase: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    colorCalendario: '#f59e0b'
  },
  confirmada: {
    etiqueta: 'Confirmada',
    corta: 'Programada',
    clase: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    colorCalendario: '#3b82f6'
  },
  en_espera: {
    etiqueta: 'En espera',
    corta: 'En espera',
    clase: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    colorCalendario: '#8b5cf6'
  },
  en_atencion: {
    etiqueta: 'En atención',
    corta: 'En atención',
    clase: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    colorCalendario: '#f43f5e'
  },
  completada: {
    etiqueta: 'Finalizada',
    corta: 'Finalizada',
    clase: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    colorCalendario: '#10b981'
  },
  no_asistio: {
    etiqueta: 'No asistió',
    corta: 'No asistió',
    clase: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    colorCalendario: '#ea580c'
  },
  cancelada: {
    etiqueta: 'Cancelada',
    corta: 'Cancelada',
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

const FILTROS_ESTADO = [
  ['todos', 'Todas'],
  ['pendiente', 'Pendientes'],
  ['confirmada', 'Confirmadas'],
  ['en_espera', 'En espera'],
  ['en_atencion', 'En atención'],
  ['completada', 'Finalizadas'],
  ['no_asistio', 'No asistió'],
  ['cancelada', 'Canceladas']
];

const TIPOS_PAGO = {
  contado: 'Pagar al finalizar',
  completo: 'Pagado',
  anticipo: 'Con anticipo',
  cuotas: 'En cuotas',
  cortesia: 'Cortesía',
  sesion: 'Incluido en plan'
};

const fechaLocal = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fechaDesdeString = (fecha) => {
  const [year, month, day] = String(fecha || '').split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0);
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

const moneda = (valor) =>
  `S/. ${Number(valor || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatearFecha = (fecha, largo = false) => {
  if (!fecha) return 'Sin fecha';
  const date = fechaDesdeString(fecha);
  const hoy = fechaLocal();
  const manana = fechaLocal(sumarDias(new Date(), 1));

  if (fecha === hoy) return 'Hoy';
  if (fecha === manana) return 'Mañana';

  return date.toLocaleDateString('es-PE', {
    weekday: largo ? 'long' : 'short',
    day: '2-digit',
    month: largo ? 'long' : 'short',
    year: 'numeric'
  });
};

function BadgeEstado({ estado }) {
  const info = ESTADOS[estado] || ESTADOS.pendiente;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${info.clase}`}>
      {estado === 'en_atencion' && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
      )}
      {info.etiqueta}
    </span>
  );
}

function EstadoStepper({ estado }) {
  const pasos = [
    ['programada', 'Programada'],
    ['en_espera', 'En espera'],
    ['en_atencion', 'En atención'],
    ['completada', 'Finalizada']
  ];
  const indice = {
    pendiente: 0,
    confirmada: 0,
    en_espera: 1,
    en_atencion: 2,
    completada: 3
  }[estado];

  if (indice === undefined) return <BadgeEstado estado={estado} />;

  return (
    <div className="grid grid-cols-4 gap-1">
      {pasos.map(([clave, etiqueta], posicion) => {
        const completado = posicion < indice;
        const actual = posicion === indice;
        return (
          <div key={clave} className="min-w-0">
            <div className="flex items-center">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                  completado
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : actual
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-600 bg-slate-800 text-slate-500'
                }`}
              >
                {completado ? <Check size={13} /> : posicion + 1}
              </span>
              {posicion < pasos.length - 1 && (
                <span className={`h-px flex-1 ${posicion < indice ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              )}
            </div>
            <div className={`mt-1 truncate text-[10px] font-medium ${actual ? 'text-cyan-300' : completado ? 'text-emerald-300' : 'text-slate-600'}`}>
              {etiqueta}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PagoResumen({ cita, compacto = false, onCobrar, onVerCuotas }) {
  const pago = cita.pago;
  const total = Number(pago?.total ?? cita.costo ?? 0);
  const cobrado = Number(pago?.cobrado || 0);
  const saldo = Number(pago?.saldo ?? Math.max(0, total - cobrado));
  const tipo = pago?.tipoPago || cita.tipoPago || 'contado';
  const pagado = saldo <= 0;

  if (compacto) {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className={`h-2.5 w-2.5 rounded-full ${pagado ? 'bg-emerald-400' : tipo === 'cuotas' ? 'bg-violet-400' : 'bg-rose-400'}`} />
        <span className="truncate text-slate-300">
          {pagado ? 'Pagado' : tipo === 'cuotas' ? `Cuotas · ${moneda(saldo)}` : `Pendiente · ${moneda(saldo)}`}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Forma de pago</div>
          <div className="mt-1 text-xs font-semibold text-slate-200">{TIPOS_PAGO[tipo] || tipo}</div>
          {pago?.metodo && pago.metodo !== 'Pendiente' && (
            <div className="mt-0.5 text-[11px] text-slate-500">Método: {pago.metodo}</div>
          )}
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${pagado ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
          {pagado ? 'PAGADO' : `DEBE ${moneda(saldo)}`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-[10px] text-slate-500">Total</div><div className="text-xs font-bold text-white">{moneda(total)}</div></div>
        <div><div className="text-[10px] text-slate-500">Cobrado</div><div className="text-xs font-bold text-emerald-300">{moneda(cobrado)}</div></div>
        <div><div className="text-[10px] text-slate-500">Saldo</div><div className={`text-xs font-bold ${saldo > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{moneda(saldo)}</div></div>
      </div>
      {saldo > 0 && pago && (
        <button
          type="button"
          onClick={() => tipo === 'cuotas' ? onVerCuotas?.(cita) : onCobrar?.(pago, cita.nombrePaciente)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-cyan-500"
        >
          {tipo === 'cuotas' ? <WalletCards size={15} /> : <CircleDollarSign size={15} />}
          {tipo === 'cuotas' ? 'Ver y pagar cuotas' : 'Registrar pago'}
        </button>
      )}
    </div>
  );
}

function BotonSecundario({ children, onClick, title, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
        danger
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function AccionPrincipal({ cita, onCambiarEstado, onCompletar, onCobrar, onVerCuotas }) {
  const estado = cita.estado || 'pendiente';
  const pago = cita.pago;
  const saldo = Number(pago?.saldo || 0);
  const tipo = pago?.tipoPago || cita.tipoPago;

  if (['pendiente', 'confirmada'].includes(estado)) {
    return (
      <button type="button" onClick={() => onCambiarEstado?.(cita, 'en_espera')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/20 transition hover:bg-violet-500">
        <UserRoundCheck size={17} /> Recibir paciente
      </button>
    );
  }

  if (estado === 'en_espera') {
    return (
      <button type="button" onClick={() => onCambiarEstado?.(cita, 'en_atencion')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-900/20 transition hover:bg-rose-500">
        <PlayCircle size={17} /> Iniciar atención
      </button>
    );
  }

  if (estado === 'en_atencion') {
    return (
      <button type="button" onClick={() => onCompletar?.(cita)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-500">
        <CheckCircle2 size={17} /> Finalizar atención
      </button>
    );
  }

  if (estado === 'completada' && saldo > 0 && pago) {
    return (
      <button type="button" onClick={() => tipo === 'cuotas' ? onVerCuotas?.(cita) : onCobrar?.(pago, cita.nombrePaciente)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 transition hover:bg-cyan-500">
        {tipo === 'cuotas' ? <WalletCards size={17} /> : <CircleDollarSign size={17} />}
        {tipo === 'cuotas' ? 'Gestionar cuotas' : 'Cobrar saldo'}
      </button>
    );
  }

  if (estado === 'completada') {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-300">
        <CheckCircle2 size={17} /> Atención finalizada
      </div>
    );
  }

  return null;
}

function TarjetaRecepcion({ cita, callbacks, onDetalle }) {
  const pago = cita.pago;
  const saldo = Number(pago?.saldo || 0);
  const tipo = pago?.tipoPago || cita.tipoPago;
  const cerrada = ['completada', 'cancelada', 'no_asistio'].includes(cita.estado);

  return (
    <article className={`rounded-2xl border bg-slate-900/70 p-3 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${cita.estado === 'en_atencion' ? 'border-rose-500/50' : 'border-slate-700'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-sm font-bold text-cyan-300">{cita.hora || '—'}</span>
            <BadgeEstado estado={cita.estado} />
          </div>
          <button type="button" onClick={() => onDetalle(cita)} className="mt-2 block truncate text-left text-sm font-bold text-white hover:text-cyan-300">
            {cita.nombrePaciente}
          </button>
          <div className="mt-1 truncate text-xs text-slate-400">{cita.procedimiento || 'Consulta'}</div>
          <div className="mt-1 text-[11px] text-slate-500">Ficha {cita.codigoFicha || '—'} · DNI {cita.cedulaPaciente || '—'}</div>
        </div>
        <button type="button" title="Ver detalle" onClick={() => onDetalle(cita)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white">
          <Eye size={16} />
        </button>
      </div>

      <div className="mt-3">
        <PagoResumen cita={cita} compacto />
      </div>

      <div className="mt-3">
        <AccionPrincipal
          cita={cita}
          onCambiarEstado={callbacks.onCambiarEstado}
          onCompletar={callbacks.onCompletar}
          onCobrar={callbacks.onCobrar}
          onVerCuotas={callbacks.onVerCuotas}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {!cerrada && (
          <BotonSecundario onClick={() => callbacks.onEditar?.(cita)} title="Editar cita"><Edit3 size={14} /> Editar</BotonSecundario>
        )}
        {['pendiente', 'confirmada', 'en_espera'].includes(cita.estado) && (
          <BotonSecundario onClick={() => callbacks.onCambiarEstado?.(cita, 'no_asistio')} title="No asistió"><UserRoundX size={14} /></BotonSecundario>
        )}
        {ESTADOS_ACTIVOS.has(cita.estado) && (
          <BotonSecundario danger onClick={() => callbacks.onCancelar?.(cita)} title="Cancelar cita"><XCircle size={14} /></BotonSecundario>
        )}
        {saldo > 0 && pago && tipo !== 'cuotas' && cita.estado !== 'cancelada' && (
          <BotonSecundario onClick={() => callbacks.onCobrar?.(pago, cita.nombrePaciente)} title="Registrar pago"><CircleDollarSign size={14} /></BotonSecundario>
        )}
      </div>
    </article>
  );
}

function ColumnaRecepcion({ titulo, subtitulo, citas, clase, callbacks, onDetalle, vacio }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-700/80 bg-slate-800/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className={`text-sm font-bold ${clase}`}>{titulo}</h3>
          <p className="text-[11px] text-slate-500">{subtitulo}</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-300">{citas.length}</span>
      </div>
      <div className="space-y-3">
        {citas.length ? citas.map((cita) => (
          <TarjetaRecepcion key={cita.id} cita={cita} callbacks={callbacks} onDetalle={onDetalle} />
        )) : (
          <div className="rounded-xl border border-dashed border-slate-700 px-3 py-8 text-center text-xs text-slate-600">{vacio}</div>
        )}
      </div>
    </section>
  );
}

function EventoCalendario({ event }) {
  return (
    <div className="min-w-0 leading-tight">
      <div className="truncate font-bold">{event.citaData.hora} · {event.citaData.nombrePaciente}</div>
      <div className="mt-0.5 truncate text-[10px] opacity-90">{event.citaData.procedimiento}</div>
      <div className="mt-1"><PagoResumen cita={event.citaData} compacto /></div>
    </div>
  );
}

function DetalleRapido({ cita, onClose, callbacks }) {
  if (!cita) return null;
  const pago = cita.pago;
  const cobrado = Number(pago?.cobrado || 0);
  const puedeEliminar = cobrado <= 0 && ['pendiente', 'cancelada', 'no_asistio'].includes(cita.estado);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-900 p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Detalle de la cita</div>
            <h2 className="mt-1 text-xl font-bold text-white">{cita.nombrePaciente}</h2>
            <div className="mt-1 text-sm text-slate-400">{formatearFecha(cita.fecha, true)} · {cita.hora}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={19} /></button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <EstadoStepper estado={cita.estado} />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300"><UserRound size={19} /></div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">{cita.procedimiento || 'Consulta'}</div>
              <div className="mt-1 text-xs text-slate-400">Ficha {cita.codigoFicha || '—'} · DNI {cita.cedulaPaciente || '—'}</div>
              {cita.telefonoPaciente && <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Phone size={13} /> {cita.telefonoPaciente}</div>}
              {cita.notas && <div className="mt-3 rounded-lg bg-slate-900/70 p-3 text-xs text-slate-400">{cita.notas}</div>}
            </div>
          </div>
        </div>

        <div className="mt-4"><PagoResumen cita={cita} onCobrar={callbacks.onCobrar} onVerCuotas={callbacks.onVerCuotas} /></div>

        <div className="mt-4">
          <AccionPrincipal cita={cita} onCambiarEstado={callbacks.onCambiarEstado} onCompletar={callbacks.onCompletar} onCobrar={callbacks.onCobrar} onVerCuotas={callbacks.onVerCuotas} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <BotonSecundario onClick={() => { onClose(); callbacks.onEditar?.(cita); }} title="Editar"><Edit3 size={15} /> Editar</BotonSecundario>
          <BotonSecundario onClick={() => callbacks.onVerFicha?.(cita.paciente)} title="Ver ficha"><FileText size={15} /> Ver ficha</BotonSecundario>
          {['pendiente', 'confirmada', 'en_espera'].includes(cita.estado) && (
            <BotonSecundario onClick={() => callbacks.onCambiarEstado?.(cita, 'no_asistio')} title="No asistió"><UserRoundX size={15} /> No asistió</BotonSecundario>
          )}
          {ESTADOS_ACTIVOS.has(cita.estado) && (
            <BotonSecundario danger onClick={() => callbacks.onCancelar?.(cita)} title="Cancelar"><XCircle size={15} /> Cancelar</BotonSecundario>
          )}
          {puedeEliminar && (
            <button type="button" onClick={() => callbacks.onEliminar?.(cita.id, cita.nombrePaciente)} className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"><Trash2 size={15} /> Eliminar definitivamente</button>
          )}
        </div>
      </aside>
    </div>
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
  onRecargar,
  onReprogramarCita,
  onVerCuotas
}) {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [rangoFecha, setRangoFecha] = useState('todas');
  const [fechaExacta, setFechaExacta] = useState('');
  const [modoVista, setModoVista] = useState('recepcion');
  const [fechaRecepcion, setFechaRecepcion] = useState(fechaLocal());
  const [limiteVisible, setLimiteVisible] = useState(30);
  const [citaDetalle, setCitaDetalle] = useState(null);

  useEffect(() => setLimiteVisible(30), [busqueda, estadoFiltro, rangoFecha, fechaExacta]);

  const pacientesPorId = useMemo(() => new Map(pacientes.map((p) => [Number(p.id), p])), [pacientes]);
  const pagosPorCita = useMemo(() => {
    const mapa = new Map();
    pagos.forEach((pago) => {
      const id = Number(pago.citaId);
      if (!Number.isNaN(id) && !mapa.has(id)) mapa.set(id, pago);
    });
    return mapa;
  }, [pagos]);

  const citasEnriquecidas = useMemo(() => citas.map((cita) => {
    const paciente = pacientesPorId.get(Number(cita.pacienteId)) || {};
    return {
      ...cita,
      paciente,
      pago: pagosPorCita.get(Number(cita.id)) || null,
      nombrePaciente: paciente.nombre || 'Paciente no encontrado',
      cedulaPaciente: paciente.cedula || '',
      codigoFicha: paciente.codigo_ficha || '',
      telefonoPaciente: paciente.telefono || '',
      correoPaciente: paciente.correo || ''
    };
  }), [citas, pacientesPorId, pagosPorCita]);

  const hoy = fechaLocal();
  const manana = fechaLocal(sumarDias(new Date(), 1));
  const finSemana = fechaLocal(sumarDias(new Date(), 7));

  const citasFiltradas = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
    return citasEnriquecidas.filter((cita) => {
      const estadoOk = estadoFiltro === 'todos' || cita.estado === estadoFiltro;
      if (!estadoOk) return false;
      if (fechaExacta && cita.fecha !== fechaExacta) return false;
      if (!fechaExacta) {
        if (rangoFecha === 'hoy' && cita.fecha !== hoy) return false;
        if (rangoFecha === 'manana' && cita.fecha !== manana) return false;
        if (rangoFecha === 'proximos7' && !(cita.fecha >= hoy && cita.fecha <= finSemana)) return false;
        if (rangoFecha === 'vencidas' && !(cita.fecha < hoy && ESTADOS_ACTIVOS.has(cita.estado))) return false;
      }
      if (!terminos.length) return true;
      const texto = normalizar([
        cita.nombrePaciente,
        cita.cedulaPaciente,
        cita.codigoFicha,
        cita.telefonoPaciente,
        cita.correoPaciente,
        cita.procedimiento,
        cita.notas,
        cita.fecha,
        cita.hora
      ].join(' '));
      return terminos.every((termino) => texto.includes(termino));
    }).sort((a, b) => `${a.fecha || ''}${a.hora || ''}`.localeCompare(`${b.fecha || ''}${b.hora || ''}`));
  }, [busqueda, citasEnriquecidas, estadoFiltro, fechaExacta, finSemana, hoy, manana, rangoFecha]);

  const citasRecepcion = useMemo(() => citasEnriquecidas
    .filter((cita) => cita.fecha === fechaRecepcion)
    .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || ''))), [citasEnriquecidas, fechaRecepcion]);

  const columnasRecepcion = useMemo(() => ({
    programadas: citasRecepcion.filter((c) => ['pendiente', 'confirmada'].includes(c.estado)),
    espera: citasRecepcion.filter((c) => c.estado === 'en_espera'),
    atencion: citasRecepcion.filter((c) => c.estado === 'en_atencion'),
    finalizadas: citasRecepcion.filter((c) => c.estado === 'completada')
  }), [citasRecepcion]);

  const eventosCalendario = useMemo(() => citasFiltradas.map((cita) => {
    const [year, month, day] = String(cita.fecha || hoy).split('-').map(Number);
    const [hour, minute] = String(cita.hora || '09:00').split(':').map(Number);
    const start = new Date(year, month - 1, day, hour || 0, minute || 0);
    return {
      id: cita.id,
      title: `${cita.nombrePaciente} · ${cita.procedimiento || 'Consulta'}`,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      estado: cita.estado,
      citaData: cita
    };
  }), [citasFiltradas, hoy]);

  const gruposLista = useMemo(() => {
    const grupos = new Map();
    citasFiltradas.forEach((cita) => {
      if (!grupos.has(cita.fecha)) grupos.set(cita.fecha, []);
      grupos.get(cita.fecha).push(cita);
    });
    return Array.from(grupos.entries());
  }, [citasFiltradas]);

  const callbacks = {
    onEditar: onEditarCita,
    onCambiarEstado,
    onCompletar: onCompletarCita,
    onCancelar: onCancelarCita,
    onCobrar,
    onVerFicha,
    onEliminar: onEliminarCita,
    onVerCuotas
  };

  const cambiarDiaRecepcion = (dias) => setFechaRecepcion(fechaLocal(sumarDias(fechaDesdeString(fechaRecepcion), dias)));
  const limpiarFiltros = () => { setBusqueda(''); setEstadoFiltro('todos'); setRangoFecha('todas'); setFechaExacta(''); };
  const hayFiltros = Boolean(busqueda) || estadoFiltro !== 'todos' || rangoFecha !== 'todas' || Boolean(fechaExacta);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">Agenda y recepción clínica</h1>
          <p className="mt-1 text-sm text-slate-400">Programa, recibe, atiende, finaliza y cobra desde una misma pantalla.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onRecargar} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-cyan-500 hover:text-white"><RefreshCw size={17} /> Actualizar</button>
          <button type="button" onClick={() => onNuevaCita?.(null)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500"><Plus size={18} /> Nueva cita</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3 shadow-xl lg:flex-row lg:items-center">
        <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1">
          {[
            ['recepcion', 'Recepción', <LayoutDashboard size={16} />],
            ['calendario', 'Calendario', <CalendarDays size={16} />],
            ['lista', 'Lista', <LayoutList size={16} />]
          ].map(([modo, etiqueta, icono]) => (
            <button key={modo} type="button" onClick={() => setModoVista(modo)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${modoVista === modo ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{icono}{etiqueta}</button>
          ))}
        </div>

        {modoVista !== 'recepcion' && (
          <>
            <div className="relative min-w-[260px] flex-1">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, DNI, ficha, teléfono o tratamiento..." className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white outline-none focus:border-cyan-500" />
              {busqueda && <button type="button" onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"><X size={15} /></button>}
            </div>
            <div className="relative min-w-[165px]">
              <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select value={rangoFecha} onChange={(e) => { setRangoFecha(e.target.value); setFechaExacta(''); }} className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-8 text-sm text-white outline-none focus:border-cyan-500">
                <option value="todas">Todas las fechas</option><option value="hoy">Hoy</option><option value="manana">Mañana</option><option value="proximos7">Próximos 7 días</option><option value="vencidas">Vencidas</option>
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            <input type="date" value={fechaExacta} onChange={(e) => { setFechaExacta(e.target.value); if (e.target.value) setRangoFecha('todas'); }} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500" />
          </>
        )}
      </div>

      {modoVista === 'recepcion' && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Jornada de recepción</div>
              <div className="mt-1 text-lg font-bold capitalize text-white">{formatearFecha(fechaRecepcion, true)}</div>
              <div className="text-xs text-slate-500">{citasRecepcion.length} cita{citasRecepcion.length === 1 ? '' : 's'} programada{citasRecepcion.length === 1 ? '' : 's'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => cambiarDiaRecepcion(-1)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setFechaRecepcion(hoy)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20">Hoy</button>
              <input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
              <button type="button" onClick={() => cambiarDiaRecepcion(1)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <ColumnaRecepcion titulo="Programadas" subtitulo="Próximas por recibir" citas={columnasRecepcion.programadas} clase="text-amber-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="No hay pacientes programados." />
            <ColumnaRecepcion titulo="En espera" subtitulo="Ya llegaron a recepción" citas={columnasRecepcion.espera} clase="text-violet-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="Nadie está esperando." />
            <ColumnaRecepcion titulo="En atención" subtitulo="Actualmente en consulta" citas={columnasRecepcion.atencion} clase="text-rose-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="No hay atención en curso." />
            <ColumnaRecepcion titulo="Finalizadas" subtitulo="Atendidas durante el día" citas={columnasRecepcion.finalizadas} clase="text-emerald-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="Aún no hay atenciones finalizadas." />
          </div>
        </>
      )}

      {modoVista !== 'recepcion' && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS_ESTADO.map(([valor, etiqueta]) => (
            <button key={valor} type="button" onClick={() => setEstadoFiltro(valor)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${estadoFiltro === valor ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'}`}>{etiqueta}</button>
          ))}
          {hayFiltros && <button type="button" onClick={limpiarFiltros} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"><X size={14} /> Limpiar</button>}
        </div>
      )}

      {modoVista === 'calendario' && (
        <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 shadow-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays size={15} /> Haz clic para ver acciones rápidas. Haz doble clic para editar.</div>
            <div className="flex flex-wrap gap-2">{['pendiente','en_espera','en_atencion','completada'].map((estado) => <span key={estado} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ESTADOS[estado].colorCalendario }} />{ESTADOS[estado].corta}</span>)}</div>
          </div>
          <div style={{ height: '72vh' }}>
            <Calendar
              localizer={localizer}
              culture="es"
              defaultView="week"
              views={['month', 'week', 'day', 'agenda']}
              events={eventosCalendario}
              components={{ event: EventoCalendario }}
              messages={{ next: 'Sig. ❯', previous: '❮ Ant.', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Lista', date: 'Fecha', time: 'Hora', event: 'Paciente / tratamiento', noEventsInRange: 'No hay citas en este rango.' }}
              eventPropGetter={(event) => ({ style: { backgroundColor: ESTADOS[event.estado]?.colorCalendario || '#475569', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', padding: '3px 6px', boxShadow: '0 2px 5px rgba(0,0,0,.18)' } })}
              selectable
              onSelectEvent={(event) => setCitaDetalle(event.citaData)}
              onDoubleClickEvent={(event) => onEditarCita?.(event.citaData)}
              onSelectSlot={(slotInfo) => onNuevaCita?.({ fecha: format(slotInfo.start, 'yyyy-MM-dd'), hora: format(slotInfo.start, 'HH:mm') === '00:00' ? '09:00' : format(slotInfo.start, 'HH:mm') })}
            />
          </div>
        </div>
      )}

      {modoVista === 'lista' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-slate-400"><ListChecks size={17} /><strong className="text-white">{citasFiltradas.length}</strong> resultado{citasFiltradas.length === 1 ? '' : 's'}</div>
          {!citasFiltradas.length ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 px-6 py-14 text-center"><CalendarDays className="mx-auto text-slate-600" size={42} /><h3 className="mt-4 font-semibold text-slate-300">No se encontraron citas</h3><button type="button" onClick={() => onNuevaCita?.(null)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"><Plus size={17} /> Agendar cita</button></div>
          ) : gruposLista.map(([fecha, citasGrupo]) => (
            <section key={fecha} className="space-y-3">
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 backdrop-blur"><div className="font-bold capitalize text-white">{formatearFecha(fecha, true)}</div><span className="text-xs text-slate-500">{citasGrupo.length} cita{citasGrupo.length === 1 ? '' : 's'}</span></div>
              {citasGrupo.slice(0, limiteVisible).map((cita) => (
                <article key={cita.id} className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 shadow-lg hover:border-cyan-500/40">
                  <div className="grid gap-4 lg:grid-cols-[105px_minmax(0,1fr)_230px_180px] lg:items-center">
                    <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center"><div className="text-lg font-bold text-cyan-300">{cita.hora}</div><BadgeEstado estado={cita.estado} /></div>
                    <div className="min-w-0"><button type="button" onClick={() => setCitaDetalle(cita)} className="truncate text-left text-base font-bold text-white hover:text-cyan-300">{cita.nombrePaciente}</button><div className="mt-1 text-sm text-cyan-100">{cita.procedimiento}</div><div className="mt-1 text-xs text-slate-500">Ficha {cita.codigoFicha || '—'} · DNI {cita.cedulaPaciente || '—'} · {cita.telefonoPaciente || 'Sin teléfono'}</div></div>
                    <PagoResumen cita={cita} onCobrar={onCobrar} onVerCuotas={onVerCuotas} />
                    <div className="space-y-2"><AccionPrincipal cita={cita} onCambiarEstado={onCambiarEstado} onCompletar={onCompletarCita} onCobrar={onCobrar} onVerCuotas={onVerCuotas} /><button type="button" onClick={() => setCitaDetalle(cita)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"><MoreHorizontal size={15} /> Ver más acciones</button></div>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}

      <DetalleRapido cita={citaDetalle} onClose={() => setCitaDetalle(null)} callbacks={callbacks} />
    </div>
  );
}
