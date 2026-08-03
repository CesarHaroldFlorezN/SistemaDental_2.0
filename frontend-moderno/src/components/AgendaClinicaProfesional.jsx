import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CalendarClock,
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
import Swal from 'sweetalert2';


const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales
});


function ToolbarCalendario({ label, onNavigate, onView, view }) {
  const vistas = [
    ['month', 'Mes'],
    ['week', 'Semana'],
    ['day', 'Día'],
    ['agenda', 'Agenda']
  ];

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/70 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onNavigate('TODAY')} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20">Hoy</button>
        <div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <button type="button" onClick={() => onNavigate('PREV')} className="border-r border-slate-700 p-2.5 text-slate-300 transition hover:bg-slate-800 hover:text-white" title="Periodo anterior"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => onNavigate('NEXT')} className="p-2.5 text-slate-300 transition hover:bg-slate-800 hover:text-white" title="Periodo siguiente"><ChevronRight size={17} /></button>
        </div>
        <div className="min-w-[190px] text-sm font-black capitalize text-white">{label}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1">
          {vistas.map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => onView(valor)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${view === valor ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const ESTADOS = {
  pendiente: {
    etiqueta: 'Programado',
    corta: 'Programado',
    clase: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    colorCalendario: '#f59e0b'
  },
  confirmada: {
    // Compatibilidad con registros antiguos: se presenta dentro de Programado.
    etiqueta: 'Programado',
    corta: 'Programado',
    clase: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    colorCalendario: '#f59e0b'
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

const normalizarEstadoVisual = (estado) => estado === 'confirmada' ? 'pendiente' : (estado || 'pendiente');

const BORDE_ESTADO = {
  pendiente: 'border-amber-500/55 hover:border-amber-400/80',
  en_espera: 'border-violet-500/55 hover:border-violet-400/80',
  en_atencion: 'border-rose-500/60 hover:border-rose-400/85',
  completada: 'border-emerald-500/55 hover:border-emerald-400/80',
  no_asistio: 'border-orange-500/55 hover:border-orange-400/80',
  cancelada: 'border-slate-600 hover:border-slate-500'
};

const ESTADOS_ACTIVOS = new Set([
  'pendiente',
  'confirmada',
  'en_espera',
  'en_atencion'
]);

const FILTROS_ESTADO = [
  ['todos', 'Todas'],
  ['pendiente', 'Programadas'],
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

const horaAMinutos = (hora) => {
  const [horas, minutos] = String(hora || '').split(':').map(Number);
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return null;
  return horas * 60 + minutos;
};

const minutosAHora = (total) => {
  const valor = Math.max(0, Math.min(1439, Number(total) || 0));
  return `${String(Math.floor(valor / 60)).padStart(2, '0')}:${String(valor % 60).padStart(2, '0')}`;
};

const obtenerHoraFinCita = (cita) => {
  if (cita?.horaFin) return cita.horaFin;
  const inicio = horaAMinutos(cita?.hora || '09:00');
  return inicio === null ? '—' : minutosAHora(inicio + Number(cita?.duracionMinutos || 60));
};

const obtenerDuracionCita = (cita) => {
  const inicio = horaAMinutos(cita?.hora);
  const fin = horaAMinutos(obtenerHoraFinCita(cita));
  if (inicio === null || fin === null || fin <= inicio) return Number(cita?.duracionMinutos || 60);
  return fin - inicio;
};


const obtenerServicios = (cita) => {
  if (Array.isArray(cita?.servicios) && cita.servicios.length) {
    return cita.servicios.filter((servicio) => servicio?.nombre);
  }
  return [{ nombre: cita?.procedimiento || 'Consulta', costo: Number(cita?.costo || 0) }];
};

function ServiciosCita({ cita, compacto = false }) {
  const servicios = obtenerServicios(cita);
  if (compacto) {
    return (
      <div className="space-y-0.5">
        {servicios.slice(0, 3).map((servicio, indice) => (
          <div key={`${servicio.nombre}-${indice}`} className="truncate text-xs font-semibold text-cyan-100">
            {servicio.nombre}
          </div>
        ))}
        {servicios.length > 3 && <div className="text-[11px] font-semibold text-cyan-400">+ {servicios.length - 3} servicio(s)</div>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {servicios.map((servicio, indice) => (
        <div key={`${servicio.nombre}-${indice}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5">
          <div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{servicio.nombre}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Servicio {indice + 1}</div></div>
          <div className="shrink-0 text-sm font-bold text-cyan-300">{moneda(servicio.costo)}</div>
        </div>
      ))}
    </div>
  );
}

function BadgeEstado({ estado }) {
  const estadoNormalizado = normalizarEstadoVisual(estado);
  const info = ESTADOS[estadoNormalizado] || ESTADOS.pendiente;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${info.clase}`}>
      {estadoNormalizado === 'en_atencion' && (
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
          {pagado ? 'Pagado' : tipo === 'cuotas' ? `Cuotas · saldo ${moneda(saldo)}` : `Saldo pendiente · ${moneda(saldo)}`}
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

function TarjetaRecepcion({ cita, callbacks, onDetalle, onDragStart, onDragEnd, arrastrando }) {
  const pago = cita.pago;
  const saldo = Number(pago?.saldo || 0);
  const tipo = pago?.tipoPago || cita.tipoPago;
  const horaFin = obtenerHoraFinCita(cita);
  const duracion = obtenerDuracionCita(cita);

  return (
    <article
      draggable
      onDragStart={(event) => onDragStart?.(event, cita)}
      onDragEnd={onDragEnd}
      className={`overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-900/95 to-slate-900/70 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl ${
        BORDE_ESTADO[normalizarEstadoVisual(cita.estado)] || BORDE_ESTADO.cancelada
      } ${arrastrando ? 'scale-[0.98] opacity-45' : ''}`}
    >
      <div className="p-3.5">
        <div className="grid grid-cols-[48px_minmax(132px,1fr)_34px] items-center gap-2">
          <div className="rounded-lg border border-slate-600 bg-slate-800/90 px-1.5 py-1 text-center shadow-inner">
            <div className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-500">Ficha</div>
            <div className="mt-0.5 truncate text-sm font-black leading-none text-white">{cita.codigoFicha || '—'}</div>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2 shadow-inner">
            <span className="whitespace-nowrap text-[13px] font-black tabular-nums text-cyan-200">{cita.hora || '—'}</span>
            <ArrowRight size={15} className="shrink-0 text-cyan-500" />
            <span className="whitespace-nowrap text-[13px] font-black tabular-nums text-cyan-200">{horaFin}</span>
          </div>

          <button type="button" title="Ver detalle" onClick={() => onDetalle(cita)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"><Eye size={16} /></button>
        </div>

        <div className="mt-3 flex items-start gap-2">
          <GripVertical size={16} className="mt-1 shrink-0 cursor-grab text-slate-600 active:cursor-grabbing" />
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => onDetalle(cita)} className="block w-full truncate text-left text-base font-black tracking-tight text-white hover:text-cyan-300">{cita.nombrePaciente}</button>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500"><CalendarClock size={13} /><span>{duracion} min de atención</span></div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <ServiciosCita cita={cita} compacto />
          <div className="justify-self-start sm:justify-self-end"><BadgeEstado estado={cita.estado} /></div>
        </div>

        <div className="mt-3"><PagoResumen cita={cita} compacto /></div>
        <div className="mt-3"><AccionPrincipal cita={cita} onCambiarEstado={callbacks.onCambiarEstado} onCompletar={callbacks.onCompletar} onCobrar={callbacks.onCobrar} onVerCuotas={callbacks.onVerCuotas} /></div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <BotonSecundario onClick={() => callbacks.onEditar?.(cita)} title="Editar servicios o cita"><Edit3 size={14} /> Editar</BotonSecundario>
          {['pendiente', 'confirmada', 'en_espera'].includes(cita.estado) && <BotonSecundario onClick={() => callbacks.onCambiarEstado?.(cita, 'no_asistio')} title="No asistió"><UserRoundX size={14} /></BotonSecundario>}
          {ESTADOS_ACTIVOS.has(cita.estado) && <BotonSecundario danger onClick={() => callbacks.onCancelar?.(cita)} title="Cancelar cita"><XCircle size={14} /></BotonSecundario>}
          {saldo > 0 && pago && tipo !== 'cuotas' && cita.estado !== 'cancelada' && <BotonSecundario onClick={() => callbacks.onCobrar?.(pago, cita.nombrePaciente)} title="Registrar pago"><CircleDollarSign size={14} /></BotonSecundario>}
        </div>
      </div>
    </article>
  );
}

function ColumnaRecepcion({
  titulo,
  subtitulo,
  citas,
  clase,
  callbacks,
  onDetalle,
  vacio,
  estadoDestino,
  citaArrastradaId,
  columnaSobre,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop
}) {
  const activa = columnaSobre === estadoDestino;

  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={(event) => { event.preventDefault(); onDragEnter?.(estadoDestino); }}
      onDrop={(event) => { event.preventDefault(); onDrop?.(estadoDestino); }}
      className={`min-w-0 rounded-2xl border p-3 transition ${activa ? 'border-cyan-400 bg-cyan-500/10 ring-2 ring-cyan-500/20' : 'border-slate-700/80 bg-slate-800/60'}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className={`text-sm font-bold ${clase}`}>{titulo}</h3>
          <p className="text-[11px] text-slate-500">{subtitulo}</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-300">{citas.length}</span>
      </div>
      <div className="space-y-3">
        {citas.length ? citas.map((cita) => (
          <TarjetaRecepcion
            key={cita.id}
            cita={cita}
            callbacks={callbacks}
            onDetalle={onDetalle}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            arrastrando={Number(citaArrastradaId) === Number(cita.id)}
          />
        )) : (
          <div className={`rounded-xl border border-dashed px-3 py-8 text-center text-xs ${activa ? 'border-cyan-500/50 text-cyan-300' : 'border-slate-700 text-slate-600'}`}>{activa ? 'Suelta aquí para cambiar el estado' : vacio}</div>
        )}
      </div>
    </section>
  );
}

function EventoCalendario({ event }) {
  return (
    <div className="min-w-0 leading-tight">
      <div className="truncate font-bold">{event.citaData.hora} → {obtenerHoraFinCita(event.citaData)} · {event.citaData.nombrePaciente}</div>
      <div className="mt-0.5"><ServiciosCita cita={event.citaData} compacto /></div>
    </div>
  );
}

const ORDEN_RESUMEN_MES = [
  ['pendiente', 'Programado', '#f59e0b'],
  ['en_espera', 'En espera', '#8b5cf6'],
  ['en_atencion', 'En atención', '#f43f5e'],
  ['completada', 'Finalizado', '#10b981'],
  ['no_asistio', 'No asistió', '#ea580c'],
  ['cancelada', 'Cancelado', '#64748b']
];

function EventoResumenMes({ event }) {
  const visibles = ORDEN_RESUMEN_MES.filter(([estado]) => Number(event.conteos?.[estado] || 0) > 0);
  return (
    <div className="dp-month-summary grid gap-1 py-0.5">
      {visibles.map(([estado, etiqueta, color]) => (
        <div key={estado} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${color}18`, color }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate">{event.conteos[estado]} {etiqueta}{event.conteos[estado] === 1 ? '' : 's'}</span>
        </div>
      ))}
    </div>
  );
}

function CabeceraFechaMes({ date, label, onAbrirDia }) {
  const esHoy = fechaLocal(date) === fechaLocal();
  return (
    <button
      type="button"
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); onAbrirDia?.(date); }}
      className={`dp-month-date ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black transition ${esHoy ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-300/40' : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'}`}
      title="Abrir vista del día"
    >
      {esHoy && <span className="text-[8px] font-black tracking-wider">HOY</span>}
      <span>{label}</span>
    </button>
  );
}

function DetalleRapido({ cita, onClose, callbacks }) {
  if (!cita) return null;
  const pago = cita.pago;
  const cobrado = Number(pago?.cobrado || 0);
  const puedeEliminar = cobrado <= 0 && ['pendiente', 'cancelada', 'no_asistio'].includes(cita.estado);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (event.target === event.currentTarget) onClose?.(); }}>
      <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Detalle de la atención</div><h2 className="mt-1 text-xl font-bold text-white">{cita.nombrePaciente}</h2><div className="mt-1 text-sm text-slate-400">{formatearFecha(cita.fecha, true)} · {cita.hora} → {obtenerHoraFinCita(cita)} · {obtenerDuracionCita(cita)} min</div></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={19} /></button>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800/70 p-4"><EstadoStepper estado={cita.estado} /></div>
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paciente</div><div className="font-semibold text-white">{cita.nombrePaciente}</div></div><div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-right"><div className="text-[10px] uppercase text-cyan-400">Ficha</div><div className="text-lg font-black text-white">{cita.codigoFicha || '—'}</div></div></div>
          {cita.telefonoPaciente && <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-400"><Phone size={13} /> {cita.telefonoPaciente}</div>}
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Servicios programados</div>
          <ServiciosCita cita={cita} />
          {cita.notas && <div className="mt-3 rounded-lg bg-slate-900/70 p-3 text-xs text-slate-400">{cita.notas}</div>}
        </div>
        <div className="mt-4"><PagoResumen cita={cita} onCobrar={callbacks.onCobrar} onVerCuotas={callbacks.onVerCuotas} /></div>
        <div className="mt-4"><AccionPrincipal cita={cita} onCambiarEstado={callbacks.onCambiarEstado} onCompletar={callbacks.onCompletar} onCobrar={callbacks.onCobrar} onVerCuotas={callbacks.onVerCuotas} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <BotonSecundario onClick={() => callbacks.onEditar?.(cita)} title="Editar servicios y cita"><Edit3 size={15} /> Editar</BotonSecundario>
          <BotonSecundario onClick={() => callbacks.onVerFicha?.(cita.paciente)} title="Abrir ficha encima"><FileText size={15} /> Ver ficha</BotonSecundario>
          {['pendiente', 'confirmada', 'en_espera'].includes(cita.estado) && <BotonSecundario onClick={() => callbacks.onCambiarEstado?.(cita, 'no_asistio')} title="No asistió"><UserRoundX size={15} /> No asistió</BotonSecundario>}
          {ESTADOS_ACTIVOS.has(cita.estado) && <BotonSecundario danger onClick={() => callbacks.onCancelar?.(cita)} title="Cancelar"><XCircle size={15} /> Cancelar</BotonSecundario>}
          {puedeEliminar && <button type="button" onClick={() => callbacks.onEliminar?.(cita.id, cita.nombrePaciente)} className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"><Trash2 size={15} /> Eliminar definitivamente</button>}
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
  const [vistaCalendario, setVistaCalendario] = useState('week');
  const [fechaCalendario, setFechaCalendario] = useState(new Date());
  const [moverCalendarioActivo, setMoverCalendarioActivo] = useState(false);
  const [citaMoverCalendarioId, setCitaMoverCalendarioId] = useState(null);
  const [citaArrastradaId, setCitaArrastradaId] = useState(null);
  const [columnaSobre, setColumnaSobre] = useState(null);
  const bloquearSeleccionRef = useRef(0);

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
  const pasadoManana = fechaLocal(sumarDias(new Date(), 2));
  const finSemana = fechaLocal(sumarDias(new Date(), 7));

  const resumenDias = useMemo(() => {
    const construir = (fecha, etiqueta, descripcion) => {
      const delDia = citasEnriquecidas.filter((cita) => cita.fecha === fecha && cita.estado !== 'cancelada');
      const programadas = delDia.filter((cita) => ['pendiente', 'confirmada'].includes(cita.estado)).length;
      return { fecha, etiqueta, descripcion, total: delDia.length, programadas };
    };
    return [
      construir(hoy, 'Hoy', 'Jornada actual'),
      construir(manana, 'Mañana', 'Próxima jornada'),
      construir(pasadoManana, 'Pasado mañana', 'Vista anticipada')
    ];
  }, [citasEnriquecidas, hoy, manana, pasadoManana]);

  const citasFiltradas = useMemo(() => {
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
    return citasEnriquecidas.filter((cita) => {
      const estadoVisual = normalizarEstadoVisual(cita.estado);
      const estadoOk = estadoFiltro === 'todos' || estadoVisual === estadoFiltro;
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
        cita.hora,
        cita.horaFin
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
    const [endHour, endMinute] = String(obtenerHoraFinCita(cita)).split(':').map(Number);
    const end = new Date(year, month - 1, day, endHour || 0, endMinute || 0);
    return {
      id: cita.id,
      title: `${cita.nombrePaciente} · ${obtenerServicios(cita)[0]?.nombre || 'Consulta'}`,
      start,
      end: end > start ? end : new Date(start.getTime() + Number(cita.duracionMinutos || 60) * 60 * 1000),
      estado: cita.estado,
      citaData: cita
    };
  }), [citasFiltradas, hoy]);

  const eventosResumenMes = useMemo(() => {
    const porFecha = new Map();
    citasFiltradas.forEach((cita) => {
      if (!cita.fecha) return;
      if (!porFecha.has(cita.fecha)) {
        porFecha.set(cita.fecha, {
          pendiente: 0,
          en_espera: 0,
          en_atencion: 0,
          completada: 0,
          no_asistio: 0,
          cancelada: 0
        });
      }
      const estado = normalizarEstadoVisual(cita.estado);
      const conteos = porFecha.get(cita.fecha);
      conteos[estado] = Number(conteos[estado] || 0) + 1;
    });

    return Array.from(porFecha.entries()).map(([fecha, conteos]) => {
      const date = fechaDesdeString(fecha);
      return {
        id: `resumen-${fecha}`,
        title: 'Resumen del día',
        start: date,
        end: sumarDias(date, 1),
        allDay: true,
        esResumenMes: true,
        fecha,
        conteos
      };
    });
  }, [citasFiltradas]);

  const resumenGlobal = useMemo(() => {
    const base = {
      total: citasFiltradas.length,
      pendiente: 0,
      en_espera: 0,
      en_atencion: 0,
      completada: 0,
      no_asistio: 0,
      cancelada: 0,
      totalFacturado: 0,
      totalCobrado: 0,
      saldoPendiente: 0
    };

    citasFiltradas.forEach((cita) => {
      const estado = normalizarEstadoVisual(cita.estado);
      base[estado] = Number(base[estado] || 0) + 1;
      const total = Number(cita.pago?.total ?? cita.costo ?? 0);
      const cobrado = Number(cita.pago?.cobrado || 0);
      const saldo = Number(cita.pago?.saldo ?? Math.max(0, total - cobrado));
      base.totalFacturado += total;
      base.totalCobrado += cobrado;
      base.saldoPendiente += saldo;
    });
    return base;
  }, [citasFiltradas]);

  useEffect(() => {
    if (modoVista !== 'calendario' || !eventosCalendario.length) return;
    if (busqueda || estadoFiltro !== 'todos' || rangoFecha !== 'todas' || fechaExacta) {
      setFechaCalendario(eventosCalendario[0].start);
    }
  }, [busqueda, estadoFiltro, eventosCalendario, fechaExacta, modoVista, rangoFecha]);

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

  const cerrarDetalleSeguro = () => {
    bloquearSeleccionRef.current = Date.now() + 350;
    setCitaDetalle(null);
  };

  const abrirVistaDia = (date) => {
    setFechaCalendario(date);
    setVistaCalendario('day');
  };

  const seleccionarSlotSeguro = async (slotInfo) => {
    if (citaDetalle || Date.now() < bloquearSeleccionRef.current) return;

    if (vistaCalendario === 'month') {
      abrirVistaDia(slotInfo.start);
      return;
    }

    if (moverCalendarioActivo) {
      const cita = citasEnriquecidas.find((item) => Number(item.id) === Number(citaMoverCalendarioId));
      if (!cita) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          title: 'Selecciona primero una cita',
          text: 'Haz clic en la cita que deseas mover y luego en el horario de destino.',
          icon: 'info',
          timer: 2400,
          showConfirmButton: false,
          background: '#283652',
          color: '#E9EDF2'
        });
        return;
      }

      const inicioDestino = slotInfo.start;
      const finDestino = new Date(inicioDestino.getTime() + obtenerDuracionCita(cita) * 60 * 1000);
      const confirmacion = await Swal.fire({
        title: '¿Mover esta cita?',
        html: `<div style="text-align:left;line-height:1.7"><strong>${cita.nombrePaciente}</strong><br>${format(inicioDestino, 'dd/MM/yyyy')}<br>${format(inicioDestino, 'HH:mm')} → ${format(finDestino, 'HH:mm')}</div>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, reprogramar',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#56759E',
        background: '#283652',
        color: '#E9EDF2'
      });

      if (confirmacion.isConfirmed) {
        await onReprogramarCita?.(cita, inicioDestino);
        setCitaMoverCalendarioId(null);
      }
      return;
    }

    const inicio = format(slotInfo.start, 'HH:mm') === '00:00' ? '09:00' : format(slotInfo.start, 'HH:mm');
    const finSeleccionado = format(slotInfo.end, 'HH:mm');
    const fin = finSeleccionado === '00:00' || finSeleccionado <= inicio
      ? minutosAHora((horaAMinutos(inicio) || 540) + 60)
      : finSeleccionado;

    onNuevaCita?.({
      fecha: format(slotInfo.start, 'yyyy-MM-dd'),
      hora: inicio,
      horaFin: fin,
      duracionMinutos: Math.max(5, (horaAMinutos(fin) || 600) - (horaAMinutos(inicio) || 540))
    });
  };

  const seleccionarEventoCalendario = (event) => {
    if (event?.esResumenMes) {
      abrirVistaDia(event.start);
      return;
    }
    if (moverCalendarioActivo) {
      setCitaMoverCalendarioId(event.citaData.id);
      return;
    }
    setCitaDetalle(event.citaData);
  };

  const iniciarArrastreRecepcion = (event, cita) => {
    setCitaArrastradaId(cita.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(cita.id));
  };

  const terminarArrastreRecepcion = () => {
    setCitaArrastradaId(null);
    setColumnaSobre(null);
  };

  const soltarEnColumna = (estadoDestino) => {
    const cita = citasEnriquecidas.find((item) => Number(item.id) === Number(citaArrastradaId));
    terminarArrastreRecepcion();
    if (!cita) return;

    const actualNormalizado = ['pendiente', 'confirmada'].includes(cita.estado) ? 'pendiente' : cita.estado;
    if (actualNormalizado === estadoDestino) return;

    if (estadoDestino === 'completada') {
      onCompletarCita?.(cita);
      return;
    }

    onCambiarEstado?.(cita, estadoDestino);
  };


  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">Agenda y recepción clínica</h1>
          <p className="mt-1 text-sm text-slate-400">Programa, recibe, atiende, finaliza y cobra desde una misma pantalla.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onNuevaCita?.(null)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500"><Plus size={18} /> Nueva cita</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3 shadow-xl lg:flex-row lg:items-center">
        <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1">
          {[
            ['recepcion', 'Recepción', <LayoutDashboard size={16} />],
            ['calendario', 'Calendario', <CalendarDays size={16} />],
            ['lista', 'Resumen', <LayoutList size={16} />]
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
          <div className="grid gap-3 md:grid-cols-3">
            {resumenDias.map((dia) => {
              const activo = fechaRecepcion === dia.fecha;
              return (
                <button key={dia.fecha} type="button" onClick={() => setFechaRecepcion(dia.fecha)} className={`rounded-2xl border p-4 text-left transition ${activo ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-950/20' : dia.programadas > 0 ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/60' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'}`}>
                  <div className="flex items-center justify-between gap-3"><div><div className={`text-xs font-bold uppercase tracking-wider ${activo ? 'text-cyan-300' : 'text-slate-400'}`}>{dia.etiqueta}</div><div className="mt-1 text-[11px] text-slate-500">{dia.descripcion}</div></div><CalendarCheck2 size={20} className={dia.programadas > 0 ? 'text-amber-300' : 'text-slate-600'} /></div>
                  <div className="mt-3 text-2xl font-black text-white">{dia.programadas}</div>
                  <div className="text-xs font-semibold text-slate-300">{dia.programadas === 1 ? 'paciente programado' : 'pacientes programados'}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{dia.total ? `${dia.total} cita(s) registradas en total` : 'Sin citas registradas'}</div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Jornada de recepción</div>
              <div className="mt-1 text-lg font-bold capitalize text-white">{formatearFecha(fechaRecepcion, true)}</div>
              <div className="text-xs text-slate-500">{citasRecepcion.length} cita{citasRecepcion.length === 1 ? '' : 's'} registrada{citasRecepcion.length === 1 ? '' : 's'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => cambiarDiaRecepcion(-1)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setFechaRecepcion(hoy)} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20">Hoy</button>
              <input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" />
              <button type="button" onClick={() => cambiarDiaRecepcion(1)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
            <span className="font-semibold text-cyan-300">Consejo:</span> arrastra una tarjeta entre columnas para cambiar rápidamente el estado del paciente.
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <ColumnaRecepcion titulo="Programadas" subtitulo="Próximas por recibir" citas={columnasRecepcion.programadas} clase="text-amber-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="No hay pacientes programados." estadoDestino="pendiente" citaArrastradaId={citaArrastradaId} columnaSobre={columnaSobre} onDragStart={iniciarArrastreRecepcion} onDragEnd={terminarArrastreRecepcion} onDragEnter={setColumnaSobre} onDrop={soltarEnColumna} />
            <ColumnaRecepcion titulo="En espera" subtitulo="Ya llegaron a recepción" citas={columnasRecepcion.espera} clase="text-violet-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="Nadie está esperando." estadoDestino="en_espera" citaArrastradaId={citaArrastradaId} columnaSobre={columnaSobre} onDragStart={iniciarArrastreRecepcion} onDragEnd={terminarArrastreRecepcion} onDragEnter={setColumnaSobre} onDrop={soltarEnColumna} />
            <ColumnaRecepcion titulo="En atención" subtitulo="Actualmente en consulta" citas={columnasRecepcion.atencion} clase="text-rose-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="No hay atención en curso." estadoDestino="en_atencion" citaArrastradaId={citaArrastradaId} columnaSobre={columnaSobre} onDragStart={iniciarArrastreRecepcion} onDragEnd={terminarArrastreRecepcion} onDragEnter={setColumnaSobre} onDrop={soltarEnColumna} />
            <ColumnaRecepcion titulo="Finalizadas" subtitulo="Atendidas durante el día" citas={columnasRecepcion.finalizadas} clase="text-emerald-300" callbacks={callbacks} onDetalle={setCitaDetalle} vacio="Aún no hay atenciones finalizadas." estadoDestino="completada" citaArrastradaId={citaArrastradaId} columnaSobre={columnaSobre} onDragStart={iniciarArrastreRecepcion} onDragEnd={terminarArrastreRecepcion} onDragEnter={setColumnaSobre} onDrop={soltarEnColumna} />
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
        <div className="agenda-calendario-pro rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 shadow-xl">
          <style>{`
            .agenda-calendario-pro .rbc-calendar { color: #e2e8f0; }
            .agenda-calendario-pro .rbc-toolbar { display: none; }
            .agenda-calendario-pro .rbc-header { padding: 10px 6px; border-color: #334155; background: rgba(15,23,42,.72); color: #cbd5e1; font-size: 12px; }
            .agenda-calendario-pro .rbc-time-view,
            .agenda-calendario-pro .rbc-month-view { border-color: #334155; border-radius: 14px; overflow: hidden; background: rgba(15,23,42,.38); }
            .agenda-calendario-pro .rbc-time-header-content,
            .agenda-calendario-pro .rbc-time-content,
            .agenda-calendario-pro .rbc-timeslot-group,
            .agenda-calendario-pro .rbc-day-bg,
            .agenda-calendario-pro .rbc-month-row { border-color: #334155; }
            .agenda-calendario-pro .rbc-timeslot-group { min-height: 76px; }
            .agenda-calendario-pro .rbc-time-slot { color: #64748b; font-size: 11px; }
            .agenda-calendario-pro .rbc-label { color: #94a3b8; font-size: 11px; padding-right: 8px; }
            .agenda-calendario-pro .rbc-today { background: rgba(6,182,212,.055); }
            .agenda-calendario-pro .rbc-current-time-indicator { height: 2px; background: #22d3ee; }
            .agenda-calendario-pro .rbc-event { margin-top: 2px; margin-bottom: 2px; border: 1px solid rgba(255,255,255,.16) !important; border-radius: 10px !important; overflow: hidden; }
            .agenda-calendario-pro .rbc-day-slot .rbc-event-content { padding: 2px 3px; }
            .agenda-calendario-pro .rbc-month-view .rbc-event { margin-left: 3px; margin-right: 3px; padding: 3px 6px !important; }
            .agenda-calendario-pro .rbc-off-range-bg { background: rgba(2,6,23,.45); }
            .agenda-calendario-pro .rbc-show-more { background: transparent; color: #67e8f9; font-size: 11px; }
            .agenda-calendario-pro .rbc-agenda-view table.rbc-agenda-table { border-color: #334155; }
            .agenda-calendario-pro .rbc-agenda-view table.rbc-agenda-table tbody > tr > td,
            .agenda-calendario-pro .rbc-agenda-view table.rbc-agenda-table thead > tr > th { border-color: #334155; padding: 10px; }
            .agenda-calendario-pro .rbc-month-view .rbc-date-cell { padding: 5px 6px 1px; }
            .agenda-calendario-pro .rbc-month-view .rbc-row-content { min-height: 92px; }
            .agenda-calendario-pro .rbc-month-view .rbc-row-segment { padding: 1px 4px; }
            .agenda-calendario-pro .rbc-month-view .rbc-event.dp-resumen-evento { background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; overflow: visible; }
            html[data-theme="light"] .agenda-calendario-pro .rbc-calendar { color: #283652; }
            html[data-theme="light"] .agenda-calendario-pro .rbc-header { background: #E9EDF2; border-color: #C5D0E0; color: #56759E; }
            html[data-theme="light"] .agenda-calendario-pro .rbc-time-view,
            html[data-theme="light"] .agenda-calendario-pro .rbc-month-view { background: #fff; border-color: #C5D0E0; }
            html[data-theme="light"] .agenda-calendario-pro .rbc-time-header-content,
            html[data-theme="light"] .agenda-calendario-pro .rbc-time-content,
            html[data-theme="light"] .agenda-calendario-pro .rbc-timeslot-group,
            html[data-theme="light"] .agenda-calendario-pro .rbc-day-bg,
            html[data-theme="light"] .agenda-calendario-pro .rbc-month-row { border-color: #C5D0E0; }
            html[data-theme="light"] .agenda-calendario-pro .rbc-off-range-bg { background: #E9EDF2; }
            html[data-theme="light"] .agenda-calendario-pro .rbc-today { background: rgba(86,117,158,.10) !important; box-shadow: inset 0 0 0 2px rgba(86,117,158,.32); }
          `}</style>

          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/55 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><CalendarDays size={15} className="text-cyan-400" /> Calendario clínico interactivo</div>
              <div className="mt-1 text-[11px] text-slate-500">Clic: ver detalle · Doble clic: editar · Selecciona un espacio para programar.</div>
            </div>
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition ${moverCalendarioActivo ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-900'}`}>
              <input type="checkbox" checked={moverCalendarioActivo} onChange={(event) => { const activo = event.target.checked; setMoverCalendarioActivo(activo); if (!activo) setCitaMoverCalendarioId(null); }} className="h-4 w-4 accent-cyan-500" />
              <div><div className={`text-xs font-bold ${moverCalendarioActivo ? 'text-cyan-300' : 'text-slate-300'}`}>Permitir mover citas</div><div className="text-[10px] text-slate-500">Selecciona una cita y luego el nuevo horario</div></div>
            </label>
          </div>

          {moverCalendarioActivo && (
            <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${citaMoverCalendarioId ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
              {citaMoverCalendarioId
                ? 'Cita seleccionada. Haz clic en el nuevo horario para confirmar el movimiento.'
                : 'Modo mover activo. Haz clic primero en la cita que deseas reprogramar.'}
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400"><strong className="text-white">{citasFiltradas.length}</strong> cita{citasFiltradas.length === 1 ? '' : 's'} visible{citasFiltradas.length === 1 ? '' : 's'} con los filtros actuales.</div>
            <div className="flex flex-wrap gap-2">{['pendiente','en_espera','en_atencion','completada'].map((estado) => <span key={estado} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ESTADOS[estado].colorCalendario }} />{ESTADOS[estado].corta}</span>)}</div>
          </div>

          <div style={{ height: '76vh', minHeight: 640 }}>
            <Calendar
              localizer={localizer}
              culture="es"
              view={vistaCalendario}
              onView={setVistaCalendario}
              date={fechaCalendario}
              onNavigate={setFechaCalendario}
              views={['month', 'week', 'day', 'agenda']}
              events={vistaCalendario === 'month' ? eventosResumenMes : eventosCalendario}
              components={{
                event: vistaCalendario === 'month' ? EventoResumenMes : EventoCalendario,
                toolbar: ToolbarCalendario,
                month: {
                  dateHeader: (props) => <CabeceraFechaMes {...props} onAbrirDia={abrirVistaDia} />
                }
              }}
              messages={{ next: 'Siguiente', previous: 'Anterior', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda', date: 'Fecha', time: 'Hora', event: 'Paciente / tratamiento', noEventsInRange: 'No hay citas en este rango.' }}
              step={15}
              timeslots={4}
              min={new Date(1970, 0, 1, 7, 0, 0)}
              max={new Date(1970, 0, 1, 21, 0, 0)}
              popup
              eventPropGetter={(event) => {
                if (event.esResumenMes) {
                  return { className: 'dp-resumen-evento', style: { background: 'transparent', border: 0, boxShadow: 'none', padding: 0, color: 'inherit' } };
                }
                const estado = normalizarEstadoVisual(event.estado);
                return { style: { backgroundColor: ESTADOS[estado]?.colorCalendario || '#64748b', color: '#fff', border: Number(event.id) === Number(citaMoverCalendarioId) ? '2px solid #67e8f9' : '1px solid rgba(255,255,255,.18)', fontSize: '12px', padding: '4px 6px', boxShadow: Number(event.id) === Number(citaMoverCalendarioId) ? '0 0 0 3px rgba(34,211,238,.25)' : '0 5px 12px rgba(0,0,0,.22)' } };
              }}
              selectable={!citaDetalle}
              onSelectEvent={seleccionarEventoCalendario}
              onDoubleClickEvent={(event) => !moverCalendarioActivo && !event.esResumenMes && onEditarCita?.(event.citaData)}
              onSelectSlot={seleccionarSlotSeguro}
              onDrillDown={abrirVistaDia}
              drilldownView="day"
            />
          </div>
        </div>
      )}

      {modoVista === 'lista' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 shadow-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-400"><ListChecks size={16} /> Resumen general</div>
                <h2 className="mt-1 text-xl font-black text-white">Citas, atención y cobros en una sola vista</h2>
                <p className="mt-1 text-xs text-slate-500">Usa el buscador y los filtros superiores para reducir este resumen.</p>
              </div>
              <div className="text-sm text-slate-400"><strong className="text-white">{resumenGlobal.total}</strong> cita{resumenGlobal.total === 1 ? '' : 's'} visible{resumenGlobal.total === 1 ? '' : 's'}</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Programadas</div><div className="mt-1 text-2xl font-black text-white">{resumenGlobal.pendiente}</div></div>
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-violet-300">En espera / atención</div><div className="mt-1 text-2xl font-black text-white">{resumenGlobal.en_espera + resumenGlobal.en_atencion}</div></div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Finalizadas</div><div className="mt-1 text-2xl font-black text-white">{resumenGlobal.completada}</div></div>
              <div className="rounded-xl border border-slate-600 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Facturado visible</div><div className="mt-1 text-lg font-black text-white">{moneda(resumenGlobal.totalFacturado)}</div><div className="mt-1 text-[11px] text-slate-500">Cobrado {moneda(resumenGlobal.totalCobrado)} · Saldo {moneda(resumenGlobal.saldoPendiente)}</div></div>
            </div>
          </div>
          {!citasFiltradas.length ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 px-6 py-14 text-center"><CalendarDays className="mx-auto text-slate-600" size={42} /><h3 className="mt-4 font-semibold text-slate-300">No se encontraron citas</h3><button type="button" onClick={() => onNuevaCita?.(null)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"><Plus size={17} /> Agendar cita</button></div>
          ) : gruposLista.map(([fecha, citasGrupo]) => (
            <section key={fecha} className="space-y-3">
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 backdrop-blur"><div className="font-bold capitalize text-white">{formatearFecha(fecha, true)}</div><span className="text-xs text-slate-500">{citasGrupo.length} cita{citasGrupo.length === 1 ? '' : 's'}</span></div>
              {citasGrupo.slice(0, limiteVisible).map((cita) => (
                <article key={cita.id} className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 shadow-lg hover:border-cyan-500/40">
                  <div className="grid gap-4 lg:grid-cols-[105px_minmax(0,1fr)_230px_180px] lg:items-center">
                    <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center"><div className="flex items-center justify-center gap-1 text-sm font-bold text-cyan-300"><span>{cita.hora}</span><ArrowRight size={13} /><span>{obtenerHoraFinCita(cita)}</span></div><div className="mt-1"><BadgeEstado estado={cita.estado} /></div></div>
                    <div className="min-w-0"><button type="button" onClick={() => setCitaDetalle(cita)} className="truncate text-left text-base font-bold text-white hover:text-cyan-300">{cita.nombrePaciente}</button><div className="mt-2"><ServiciosCita cita={cita} compacto /></div><div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400"><strong className="text-cyan-300">Ficha {cita.codigoFicha || '—'}</strong><span>·</span><span>{cita.telefonoPaciente || 'Sin teléfono'}</span></div></div>
                    <PagoResumen cita={cita} onCobrar={onCobrar} onVerCuotas={onVerCuotas} />
                    <div className="space-y-2"><AccionPrincipal cita={cita} onCambiarEstado={onCambiarEstado} onCompletar={onCompletarCita} onCobrar={onCobrar} onVerCuotas={onVerCuotas} /><button type="button" onClick={() => setCitaDetalle(cita)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"><MoreHorizontal size={15} /> Ver más acciones</button></div>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}

      <DetalleRapido cita={citaDetalle} onClose={cerrarDetalleSeguro} callbacks={callbacks} />
    </div>
  );
}
