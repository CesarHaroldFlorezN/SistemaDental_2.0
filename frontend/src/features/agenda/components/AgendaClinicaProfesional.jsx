// DENTALPRO_V8_2_VISUAL_CALENDARIO
import { Component, Suspense, lazy, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  Eye,
  FileText,
  Filter,
  GripVertical,
  LayoutDashboard,
  LayoutList,
  Lock,
  Phone,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  Unlock,
  UserRoundCheck,
  UserRoundX,
  WalletCards,
  X,
  XCircle
} from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, getDay, parse, startOfWeek as startOfWeekDateFns } from 'date-fns';
import { es } from 'date-fns/locale';

const CalendarioDnD = lazy(() => import('./CalendarioDnD.jsx'));

const inicioSemanaLunes = (fecha) => startOfWeekDateFns(fecha, {
  locale: es,
  weekStartsOn: 1
});

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: inicioSemanaLunes,
  getDay,
  locales: { es }
});

const ESTADOS = {
  pendiente: { texto: 'Programada', color: '#f59e0b', clase: 'border-amber-500/55' },
  confirmada: { texto: 'Programada', color: '#f59e0b', clase: 'border-amber-500/55' },
  en_espera: { texto: 'En espera', color: '#8b5cf6', clase: 'border-violet-500/55' },
  en_atencion: { texto: 'En atención', color: '#f43f5e', clase: 'border-rose-500/60' },
  completada: { texto: 'Finalizada', color: '#10b981', clase: 'border-emerald-500/55' },
  no_asistio: { texto: 'No asistió', color: '#ea580c', clase: 'border-orange-500/55' },
  cancelada: { texto: 'Cancelada', color: '#64748b', clase: 'border-slate-500/55' }
};

const ACTIVAS = new Set(['pendiente', 'confirmada', 'en_espera', 'en_atencion']);

const moneda = (valor) => `S/. ${Number(valor || 0).toLocaleString('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const fechaLocal = (fecha = new Date()) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fechaDesdeTexto = (texto) => {
  const [y, m, d] = String(texto || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
};

const horaAMinutos = (hora) => {
  const [h, m] = String(hora || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

const minutosAHora = (total) => {
  const valor = Math.max(0, Math.min(1439, Number(total) || 0));
  return `${String(Math.floor(valor / 60)).padStart(2, '0')}:${String(valor % 60).padStart(2, '0')}`;
};

const horaFin = (cita) => {
  if (cita?.horaFin) return cita.horaFin;
  const inicio = horaAMinutos(cita?.hora || '09:00');
  return minutosAHora((inicio || 540) + Number(cita?.duracionMinutos || 60));
};

const servicios = (cita) => Array.isArray(cita?.servicios) && cita.servicios.length
  ? cita.servicios
  : [{ nombre: cita?.procedimiento || 'Consulta', costo: cita?.costo || 0 }];

const estadoVisual = (estado) => estado === 'confirmada' ? 'pendiente' : (estado || 'pendiente');


const FILTROS_ESTADO = [
  ['todos', 'Todos los estados'],
  ['pendiente', 'Programadas'],
  ['en_espera', 'En espera'],
  ['en_atencion', 'En atención'],
  ['completada', 'Finalizadas'],
  ['no_asistio', 'No asistió'],
  ['cancelada', 'Canceladas']
];

const normalizarTexto = (valor) => String(valor ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const sumarDias = (fecha, cantidad) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + cantidad);
  return copia;
};

function BadgeEstado({ estado }) {
  const clave = estadoVisual(estado);
  const info = ESTADOS[clave] || ESTADOS.pendiente;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black" style={{ color: info.color, borderColor: `${info.color}55`, backgroundColor: `${info.color}18` }}>
      {clave === 'en_atencion' && <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: info.color }} />}
      {info.texto}
    </span>
  );
}

function EstadoStepper({ estado }) {
  const pasos = [
    ['pendiente', 'Programada'],
    ['en_espera', 'En espera'],
    ['en_atencion', 'En atención'],
    ['completada', 'Finalizada']
  ];
  const indice = { pendiente: 0, confirmada: 0, en_espera: 1, en_atencion: 2, completada: 3 }[estado];
  if (indice === undefined) return <BadgeEstado estado={estado} />;

  return (
    <div className="grid grid-cols-4 gap-1">
      {pasos.map(([clave, texto], posicion) => {
        const completado = posicion < indice;
        const actual = posicion === indice;
        return (
          <div key={clave} className="min-w-0">
            <div className="flex items-center">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${completado ? 'border-emerald-500 bg-emerald-500 text-white' : actual ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300' : 'border-slate-600 bg-slate-800 text-slate-500'}`}>
                {completado ? <CheckCircle2 size={14} /> : posicion + 1}
              </span>
              {posicion < pasos.length - 1 && <span className={`h-px flex-1 ${posicion < indice ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
            </div>
            <div className={`mt-1 truncate text-[9px] font-bold ${actual ? 'text-cyan-300' : completado ? 'text-emerald-300' : 'text-slate-600'}`}>{texto}</div>
          </div>
        );
      })}
    </div>
  );
}

function PagoResumen({ cita, callbacks }) {
  const pago = cita.pago;
  const total = Number(pago?.total ?? cita.costo ?? 0);
  const cobrado = Number(pago?.cobrado || 0);
  const saldo = Number(pago?.saldo ?? Math.max(0, total - cobrado));
  const pagado = saldo <= 0;
  const tipo = pago?.tipoPago || cita.tipoPago || 'contado';

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Estado financiero</div>
          <div className={`mt-1 text-sm font-black ${pagado ? 'text-emerald-300' : 'text-rose-300'}`}>{pagado ? 'Pagado completamente' : 'Saldo pendiente'}</div>
          {pago?.metodo && pago.metodo !== 'Pendiente' && <div className="mt-0.5 text-xs text-slate-500">Último método: {pago.metodo}</div>}
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${pagado ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>{pagado ? 'PAGADO' : `DEBE ${moneda(saldo)}`}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-900/60 p-2"><div className="text-[9px] uppercase text-slate-500">Total</div><div className="mt-1 text-xs font-black text-white">{moneda(total)}</div></div>
        <div className="rounded-xl bg-slate-900/60 p-2"><div className="text-[9px] uppercase text-slate-500">Pagado</div><div className="mt-1 text-xs font-black text-emerald-300">{moneda(cobrado)}</div></div>
        <div className="rounded-xl bg-slate-900/60 p-2"><div className="text-[9px] uppercase text-slate-500">Saldo</div><div className={`mt-1 text-xs font-black ${saldo > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{moneda(saldo)}</div></div>
      </div>
      {saldo > 0 && pago && (
        <button type="button" onClick={() => tipo === 'cuotas' ? callbacks.onVerCuotas?.(cita) : callbacks.onCobrar?.(pago, cita.nombrePaciente)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white hover:bg-cyan-500">
          {tipo === 'cuotas' ? <WalletCards size={16} /> : <CircleDollarSign size={16} />}
          {tipo === 'cuotas' ? 'Ver y pagar cuotas' : 'Registrar pago'}
        </button>
      )}
    </div>
  );
}

function AccionPrincipal({ cita, callbacks }) {
  if (['pendiente', 'confirmada'].includes(cita.estado)) {
    return <button type="button" onClick={() => callbacks.onCambiarEstado?.(cita, 'en_espera')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-500"><UserRoundCheck size={17} />Recibir paciente</button>;
  }
  if (cita.estado === 'en_espera') {
    return <button type="button" onClick={() => callbacks.onCambiarEstado?.(cita, 'en_atencion')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-500"><PlayCircle size={17} />Iniciar atención</button>;
  }
  if (cita.estado === 'en_atencion') {
    return <button type="button" onClick={() => callbacks.onCompletar?.(cita)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-500"><CheckCircle2 size={17} />Finalizar atención</button>;
  }
  if (cita.estado === 'completada') {
    return <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-300"><CheckCircle2 size={17} />Atención finalizada</div>;
  }
  return null;
}

class LimiteErrorCalendario extends Component {
  constructor(props) {
    super(props);
    this.state = { fallo: false };
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error) {
    console.error('DentalPro: el calendario interactivo no pudo cargarse.', error);
  }

  render() {
    if (this.state.fallo) return this.props.fallback;
    return this.props.children;
  }
}

function Toolbar({ label, view, onNavigate, onView }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onNavigate('TODAY')} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-300">Hoy</button>
        <div className="flex overflow-hidden rounded-xl border border-slate-700">
          <button type="button" onClick={() => onNavigate('PREV')} className="border-r border-slate-700 p-2.5 text-slate-300 hover:bg-slate-800"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => onNavigate('NEXT')} className="p-2.5 text-slate-300 hover:bg-slate-800"><ChevronRight size={17} /></button>
        </div>
        <div className="min-w-[190px] text-sm font-black capitalize text-white">{label}</div>
      </div>
      <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1">
        {[
          ['month', 'Mes'],
          ['week', 'Semana'],
          ['day', 'Dia']
        ].map(([valor, texto]) => (
          <button key={valor} type="button" onClick={() => onView(valor)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === valor ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{texto}</button>
        ))}
      </div>
    </div>
  );
}

function Evento({ event, editable }) {
  const cita = event.citaData;
  return (
    <div className={`dp-evento-calendario flex h-full min-w-0 flex-col justify-center overflow-hidden px-2 py-1 leading-tight ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
      <div className="truncate text-[10px] font-black tabular-nums tracking-tight text-white">{cita.hora} - {horaFin(cita)}</div>
      <div className="mt-0.5 truncate text-[12px] font-black text-white">{cita.nombrePaciente}</div>
    </div>
  );
}

function LeyendaEstados() {
  const estados = ['pendiente', 'en_espera', 'en_atencion', 'completada', 'no_asistio', 'cancelada'];
  return (
    <div className="dp-leyenda-calendario flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-700 bg-slate-900/55 px-3 py-2.5">
      <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Estados</span>
      {estados.map((estado) => (
        <div key={estado} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: ESTADOS[estado].color }} />
          <span>{ESTADOS[estado].texto}</span>
        </div>
      ))}
    </div>
  );
}

function ResumenMes({ event }) {
  const orden = [
    ['pendiente', 'Programada'],
    ['en_espera', 'En espera'],
    ['en_atencion', 'En atención'],
    ['completada', 'Finalizada'],
    ['no_asistio', 'No asistió'],
    ['cancelada', 'Cancelada']
  ];
  return (
    <div className="space-y-1 py-0.5">
      {orden.filter(([estado]) => event.conteos[estado]).map(([estado, texto]) => (
        <div key={estado} className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-bold" style={{ color: ESTADOS[estado].color, backgroundColor: `${ESTADOS[estado].color}16` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ESTADOS[estado].color }} />
          <span>{event.conteos[estado]} {texto}{event.conteos[estado] === 1 ? '' : 's'}</span>
        </div>
      ))}
    </div>
  );
}

function TarjetaRecepcion({ cita, callbacks, onDetalle, onDragStart, onDragEnd }) {
  const pago = cita.pago;
  const saldo = Number(pago?.saldo ?? cita.costo ?? 0);
  const estado = estadoVisual(cita.estado);
  return (
    <article draggable={ACTIVAS.has(cita.estado)} onDragStart={(e) => ACTIVAS.has(cita.estado) && onDragStart(e, cita)} onDragEnd={onDragEnd} className={`rounded-2xl border bg-slate-900/80 p-3.5 shadow-lg ${ESTADOS[estado]?.clase || 'border-slate-600'}`}>
      <div className="grid grid-cols-[42px_minmax(0,1fr)_32px] items-center gap-2">
        <div className="rounded-lg border border-slate-600 bg-slate-800 px-1 py-1 text-center">
          <div className="text-[6px] font-black uppercase tracking-wider text-slate-500">Ficha</div>
          <div className="truncate text-xs font-black text-white">{cita.codigoFicha || '—'}</div>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-2 py-2 text-xs font-black text-cyan-200">
          <span>{cita.hora || '—'}</span><ArrowRight size={14} /><span>{horaFin(cita)}</span>
        </div>
        <button type="button" onClick={() => onDetalle(cita)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-cyan-300"><Eye size={15} /></button>
      </div>
      <div className="mt-3 flex gap-2">
        <GripVertical size={15} className="mt-1 shrink-0 cursor-grab text-slate-600" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onDetalle(cita)} className="w-full truncate text-left font-black text-white hover:text-cyan-300">{cita.nombrePaciente}</button>
          <div className="mt-1 truncate text-xs text-cyan-100">{servicios(cita).map((s) => s.nombre).join(' + ')}</div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span style={{ color: ESTADOS[estado]?.color }}>{ESTADOS[estado]?.texto}</span>
            <span className={saldo > 0 ? 'text-rose-300' : 'text-emerald-300'}>{saldo > 0 ? `Debe ${moneda(saldo)}` : 'Pagado'}</span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        {['pendiente', 'confirmada'].includes(cita.estado) && <button type="button" onClick={() => callbacks.onCambiarEstado(cita, 'en_espera')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"><UserRoundCheck size={15} />Recibir paciente</button>}
        {cita.estado === 'en_espera' && <button type="button" onClick={() => callbacks.onCambiarEstado(cita, 'en_atencion')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white"><PlayCircle size={15} />Iniciar atencion</button>}
        {cita.estado === 'en_atencion' && <button type="button" onClick={() => callbacks.onCompletar(cita)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 size={15} />Finalizar atencion</button>}
        {cita.estado === 'completada' && saldo > 0 && pago && <button type="button" onClick={() => pago.tipoPago === 'cuotas' ? callbacks.onVerCuotas(cita) : callbacks.onCobrar(pago, cita.nombrePaciente)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white">{pago.tipoPago === 'cuotas' ? <WalletCards size={15} /> : <CircleDollarSign size={15} />}Cobrar saldo</button>}
      </div>
      <div className="mt-2 flex gap-1.5">
        {ACTIVAS.has(cita.estado) && <button type="button" onClick={() => callbacks.onEditar(cita)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300" title="Editar cita activa"><Edit3 size={13} /></button>}
        {ACTIVAS.has(cita.estado) && <button type="button" onClick={() => callbacks.onCancelar(cita)} className="rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs text-rose-300"><XCircle size={13} /></button>}
        {cita.estado === 'completada' && <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">Cierre protegido</span>}
      </div>
    </article>
  );
}

function Columna({ titulo, estado, citas, callbacks, onDetalle, arrastre }) {
  const activa = arrastre.sobre === estado;
  return (
    <section onDragOver={(e) => e.preventDefault()} onDragEnter={() => arrastre.setSobre(estado)} onDrop={() => arrastre.soltar(estado)} className={`rounded-2xl border p-3 ${activa ? 'border-cyan-400 bg-cyan-500/10 ring-2 ring-cyan-500/20' : 'border-slate-700 bg-slate-800/60'}`}>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-white">{titulo}</h3><span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-300">{citas.length}</span></div>
      <div className="space-y-3">
        {citas.length ? citas.map((cita) => <TarjetaRecepcion key={cita.id} cita={cita} callbacks={callbacks} onDetalle={onDetalle} onDragStart={arrastre.iniciar} onDragEnd={arrastre.terminar} />) : <div className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-xs text-slate-600">Sin pacientes</div>}
      </div>
    </section>
  );
}


function DetalleRapido({ cita, onClose, callbacks }) {
  if (!cita) return null;
  const pago = cita.pago;
  const cobrado = Number(pago?.cobrado || 0);
  const puedeEliminar = cobrado <= 0 && ['pendiente', 'cancelada', 'no_asistio'].includes(cita.estado);
  const finalizada = cita.estado === 'completada';

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/65 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-cyan-400">Resumen de la atención</div>
            <h2 className="mt-1 truncate text-xl font-black text-white">{cita.nombrePaciente}</h2>
            <div className="mt-1 text-sm text-slate-400">{fechaDesdeTexto(cita.fecha).toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · {cita.hora} - {horaFin(cita)}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={19} /></button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <EstadoStepper estado={cita.estado} />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Paciente</div>
              <div className="truncate font-black text-white">{cita.nombrePaciente}</div>
              {cita.telefonoPaciente && <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Phone size={13} />{cita.telefonoPaciente}</div>}
            </div>
            <div className="shrink-0 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-right">
              <div className="text-[9px] font-black uppercase text-cyan-400">Ficha</div>
              <div className="text-base font-black text-white">{cita.codigoFicha || '—'}</div>
            </div>
          </div>

          <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Servicios</div>
          <div className="space-y-2">
            {servicios(cita).map((servicio, indice) => (
              <div key={`${servicio.nombre}-${indice}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/65 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{servicio.nombre}</div>
                  {servicio.realizado === false && <div className="mt-0.5 text-[10px] font-black uppercase text-amber-300">No realizado</div>}
                </div>
                <div className="shrink-0 text-sm font-black text-cyan-300">{moneda(servicio.costo)}</div>
              </div>
            ))}
          </div>
          {cita.notas && <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300"><span className="font-black text-slate-500">Nota de la cita: </span>{cita.notas}</div>}
          {cita.notasFin && <div className="mt-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100"><span className="font-black text-cyan-400">Cierre clínico: </span>{cita.notasFin}</div>}
        </div>

        <div className="mt-4"><PagoResumen cita={cita} callbacks={callbacks} /></div>
        <div className="mt-4"><AccionPrincipal cita={cita} callbacks={callbacks} /></div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {!finalizada && <button type="button" onClick={() => { callbacks.onEditar?.(cita); onClose?.(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs font-black text-slate-200 hover:border-cyan-500/50 hover:text-white"><Edit3 size={15} />Editar cita</button>}
          <button type="button" onClick={() => { callbacks.onVerFicha?.(cita.paciente); onClose?.(); }} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-xs font-black text-slate-200 hover:border-cyan-500/50 hover:text-white ${finalizada ? 'col-span-2' : ''}`}><FileText size={15} />{finalizada ? 'Ver cierre, cuenta y pagos' : 'Ver ficha completa'}</button>
          {['pendiente', 'confirmada', 'en_espera'].includes(cita.estado) && <button type="button" onClick={() => callbacks.onCambiarEstado?.(cita, 'no_asistio')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-xs font-black text-orange-300"><UserRoundX size={15} />No asistió</button>}
          {ACTIVAS.has(cita.estado) && <button type="button" onClick={() => callbacks.onCancelar?.(cita)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-black text-rose-300"><XCircle size={15} />Cancelar cita</button>}
          {puedeEliminar && callbacks.onEliminar && <button type="button" onClick={() => callbacks.onEliminar(cita.id, cita.nombrePaciente)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-black text-rose-300 hover:bg-rose-500/20"><Trash2 size={15} />Eliminar definitivamente</button>}
        </div>

        {finalizada && <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed text-emerald-100">La atención clínica permanece finalizada. Los cobros incorrectos se corrigen mediante una anulación o devolución para conservar la trazabilidad.</div>}
      </aside>
    </div>
  );
}

export default function AgendaClinicaProfesional({  citas = [], pacientes = [], pagos = [], onNuevaCita, onEditarCita, onCambiarEstado,
  onCompletarCita, onCancelarCita, onCobrar, onVerFicha, onEliminarCita,
  onReprogramarCita, onVerCuotas
}) {
  const [modo, setModo] = useState('recepcion');
  const [fechaRecepcion, setFechaRecepcion] = useState(fechaLocal());
  const [vista, setVista] = useState('week');
  const [fechaCalendario, setFechaCalendario] = useState(new Date());
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [rangoFecha, setRangoFecha] = useState('todas');
  const [fechaExacta, setFechaExacta] = useState('');
  const [edicionHorarios, setEdicionHorarios] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [arrastradaId, setArrastradaId] = useState(null);
  const [columnaSobre, setColumnaSobre] = useState(null);

  const enriquecidas = useMemo(() => citas.map((cita) => {
    const paciente = pacientes.find((p) => Number(p.id) === Number(cita.pacienteId));
    const pago = pagos.find((p) => Number(p.citaId) === Number(cita.id));
    return {
      ...cita,
      paciente,
      nombrePaciente: paciente?.nombre || cita.nombrePaciente || 'Paciente',
      codigoFicha: paciente?.codigo_ficha || cita.codigoFicha || '',
      cedulaPaciente: paciente?.cedula || '',
      telefonoPaciente: paciente?.telefono || '',
      correoPaciente: paciente?.correo || '',
      pago
    };
  }), [citas, pacientes, pagos]);

  const hoy = fechaLocal();
  const manana = fechaLocal(sumarDias(new Date(), 1));
  const finSemana = fechaLocal(sumarDias(new Date(), 7));

  const filtradas = useMemo(() => {
    const terminos = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
    return enriquecidas.filter((cita) => {
      const visual = estadoVisual(cita.estado);
      if (estadoFiltro !== 'todos' && visual !== estadoFiltro) return false;
      if (fechaExacta && cita.fecha !== fechaExacta) return false;
      if (!fechaExacta) {
        if (rangoFecha === 'hoy' && cita.fecha !== hoy) return false;
        if (rangoFecha === 'manana' && cita.fecha !== manana) return false;
        if (rangoFecha === 'proximos7' && !(cita.fecha >= hoy && cita.fecha <= finSemana)) return false;
        if (rangoFecha === 'vencidas' && !(cita.fecha < hoy && ACTIVAS.has(cita.estado))) return false;
      }
      if (!terminos.length) return true;
      const textoBusqueda = normalizarTexto([
        cita.nombrePaciente,
        cita.codigoFicha,
        cita.cedulaPaciente,
        cita.telefonoPaciente,
        cita.correoPaciente,
        cita.procedimiento,
        cita.notas,
        cita.fecha,
        cita.hora,
        ...servicios(cita).map((servicio) => servicio.nombre)
      ].join(' '));
      return terminos.every((termino) => textoBusqueda.includes(termino));
    });
  }, [enriquecidas, busqueda, estadoFiltro, rangoFecha, fechaExacta, hoy, manana, finSemana]);

  const eventos = useMemo(() => filtradas.map((cita) => {
    const [y, m, d] = String(cita.fecha).split('-').map(Number);
    const [hi, mi] = String(cita.hora || '09:00').split(':').map(Number);
    const [hf, mf] = String(horaFin(cita)).split(':').map(Number);
    const start = new Date(y, m - 1, d, hi, mi);
    let end = new Date(y, m - 1, d, hf, mf);
    if (end <= start) end = new Date(start.getTime() + Number(cita.duracionMinutos || 60) * 60000);
    return { id: cita.id, title: cita.nombrePaciente, start, end, citaData: cita };
  }), [filtradas]);

  const resumenMes = useMemo(() => {
    const mapa = new Map();
    filtradas.forEach((cita) => {
      if (!mapa.has(cita.fecha)) mapa.set(cita.fecha, { pendiente: 0, en_espera: 0, en_atencion: 0, completada: 0, no_asistio: 0, cancelada: 0 });
      const clave = estadoVisual(cita.estado);
      mapa.get(cita.fecha)[clave] += 1;
    });
    return [...mapa.entries()].map(([fecha, conteos]) => ({ id: `r-${fecha}`, title: 'Resumen', start: fechaDesdeTexto(fecha), end: new Date(fechaDesdeTexto(fecha).getTime() + 86400000), allDay: true, esResumen: true, conteos }));
  }, [filtradas]);

  const recepcion = useMemo(() => enriquecidas.filter((c) => c.fecha === fechaRecepcion).sort((a, b) => String(a.hora).localeCompare(String(b.hora))), [enriquecidas, fechaRecepcion]);
  const columnas = {
    pendiente: recepcion.filter((c) => ['pendiente', 'confirmada'].includes(c.estado)),
    en_espera: recepcion.filter((c) => c.estado === 'en_espera'),
    en_atencion: recepcion.filter((c) => c.estado === 'en_atencion'),
    completada: recepcion.filter((c) => c.estado === 'completada')
  };

  const callbacks = {
    onEditar: onEditarCita,
    onCambiarEstado,
    onCompletar: onCompletarCita,
    onCancelar: onCancelarCita,
    onCobrar,
    onVerCuotas,
    onVerFicha,
    onEliminar: onEliminarCita
  };

  const arrastre = {
    sobre: columnaSobre,
    setSobre: setColumnaSobre,
    iniciar: (event, cita) => { setArrastradaId(cita.id); event.dataTransfer.setData('text/plain', String(cita.id)); event.dataTransfer.effectAllowed = 'move'; },
    terminar: () => { setArrastradaId(null); setColumnaSobre(null); },
    soltar: (destino) => {
      const cita = enriquecidas.find((c) => Number(c.id) === Number(arrastradaId));
      setArrastradaId(null); setColumnaSobre(null);
      if (!cita) return;
      const actual = ['pendiente', 'confirmada'].includes(cita.estado) ? 'pendiente' : cita.estado;
      if (actual === destino) return;
      if (destino === 'completada') onCompletarCita?.(cita);
      else onCambiarEstado?.(cita, destino);
    }
  };

  const guardarCambioHorario = async ({ event, start, end }) => {
    const cita = event.citaData;
    if (!cita || !ACTIVAS.has(cita.estado)) return;
    await onReprogramarCita?.(cita, start, end);
  };

  const abrirEvento = (event) => {
    if (event.esResumen) { setFechaCalendario(event.start); setVista('day'); return; }
    setDetalle(event.citaData);
  };

  const seleccionarSlot = (slot) => {
    if (vista === 'month') { setFechaCalendario(slot.start); setVista('day'); return; }
    if (edicionHorarios) return;
    const inicio = format(slot.start, 'HH:mm') === '00:00' ? '09:00' : format(slot.start, 'HH:mm');
    const fin = format(slot.end, 'HH:mm') > inicio ? format(slot.end, 'HH:mm') : minutosAHora((horaAMinutos(inicio) || 540) + 60);
    onNuevaCita?.({ fecha: format(slot.start, 'yyyy-MM-dd'), hora: inicio, horaFin: fin, duracionMinutos: (horaAMinutos(fin) || 600) - (horaAMinutos(inicio) || 540) });
  };

  const propiedadesEvento = (event) => {
    if (event.esResumen) return { style: { background: 'transparent', border: 0, padding: 0, color: 'inherit' } };
    const info = ESTADOS[estadoVisual(event.citaData.estado)] || ESTADOS.pendiente;
    return {
      className: 'dp-tarjeta-calendario',
      style: {
        '--dp-event-color': info.color,
        backgroundColor: `${info.color}4D`,
        color: '#ffffff',
        border: `1px solid ${info.color}D9`,
        borderLeft: `5px solid ${info.color}`,
        borderRadius: 10,
        padding: 0,
        boxShadow: edicionHorarios
          ? `0 0 0 2px ${info.color}4D, 0 9px 20px rgba(15,23,42,.30)`
          : '0 4px 12px rgba(15,23,42,.22)',
        cursor: edicionHorarios ? 'grab' : 'pointer',
        overflow: 'hidden'
      }
    };
  };

  const calendarioComun = {
    localizer,
    culture: 'es',
    events: vista === 'month' ? resumenMes : eventos,
    startAccessor: 'start',
    endAccessor: 'end',
    view: vista,
    date: fechaCalendario,
    onView: (nueva) => setVista(nueva === 'agenda' ? 'week' : nueva),
    onNavigate: setFechaCalendario,
    views: ['month', 'week', 'day'],
    step: 15,
    timeslots: 4,
    min: new Date(1970, 0, 1, 7, 0),
    max: new Date(1970, 0, 1, 21, 0),
    selectable: !edicionHorarios,
    onSelectSlot: seleccionarSlot,
    onSelectEvent: abrirEvento,
    eventPropGetter: propiedadesEvento,
    components: { toolbar: Toolbar, event: (props) => props.event.esResumen ? <ResumenMes {...props} /> : <Evento {...props} editable={edicionHorarios} /> },
    formats: {
      dayFormat: (fecha) => format(fecha, 'EEE dd', { locale: es }),
      weekdayFormat: (fecha) => format(fecha, 'EEEE', { locale: es }),
      monthHeaderFormat: (fecha) => format(fecha, 'MMMM yyyy', { locale: es }),
      dayHeaderFormat: (fecha) => format(fecha, "EEEE dd 'de' MMMM", { locale: es }),
      timeGutterFormat: (fecha) => format(fecha, 'HH:mm', { locale: es }),
      eventTimeRangeFormat: ({ start, end }) => `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`
    },
    messages: { today: 'Hoy', previous: 'Anterior', next: 'Siguiente', month: 'Mes', week: 'Semana', day: 'Día', noEventsInRange: 'No hay citas.' },
    style: { height: 720 }
  };

  const fallbackCalendario = (
    <div>
      <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">El modo interactivo no pudo cargarse. El calendario estable sigue disponible; desactiva Editar horarios.</div>
      <Calendar {...calendarioComun} />
    </div>
  );

  return (
    <div className="dp-agenda-profesional space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div><h1 className="text-3xl font-bold text-cyan-400">Agenda y recepción clínica</h1><p className="mt-1 text-sm text-slate-400">Gestiona pacientes, horarios y cobros desde una sola vista.</p></div>
        <button type="button" onClick={() => onNuevaCita?.(null)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white"><Plus size={18} />Nueva cita</button>
      </div>

      <div className="dp-barra-agenda flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-3">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap rounded-xl border border-slate-700 bg-slate-900 p-1 sm:w-fit">
            {[
              ['recepcion', 'Recepción', <LayoutDashboard size={16} />],
              ['calendario', 'Calendario', <CalendarDays size={16} />],
              ['resumen', 'Resumen', <LayoutList size={16} />]
            ].map(([valor, texto, icono]) => <button key={valor} type="button" onClick={() => setModo(valor)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold sm:flex-none ${modo === valor ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{icono}{texto}</button>)}
          </div>

          {modo !== 'recepcion' && (
            <div className="dp-filtros-agenda grid min-w-0 w-full gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(250px,1.35fr)_minmax(155px,.72fr)_minmax(155px,.72fr)_minmax(145px,.62fr)]">
              <div className="relative min-w-0">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, DNI, ficha, teléfono o servicio..." className="dp-control-filtro w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-9 text-sm text-white outline-none focus:border-cyan-500" />
                {busqueda && <button type="button" onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"><X size={14} /></button>}
              </div>
              <div className="relative min-w-0">
                <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="dp-control-filtro w-full min-w-0 appearance-none rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-8 text-sm text-white outline-none focus:border-cyan-500">
                  {FILTROS_ESTADO.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <div className="relative min-w-0">
                <select value={rangoFecha} onChange={(e) => { setRangoFecha(e.target.value); setFechaExacta(''); }} className="dp-control-filtro w-full min-w-0 appearance-none rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-3 pr-8 text-sm text-white outline-none focus:border-cyan-500">
                  <option value="todas">Todas las fechas</option>
                  <option value="hoy">Hoy</option>
                  <option value="manana">Mañana</option>
                  <option value="proximos7">Próximos 7 días</option>
                  <option value="vencidas">Citas vencidas</option>
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <input type="date" value={fechaExacta} onChange={(e) => { setFechaExacta(e.target.value); if (e.target.value) setRangoFecha('todas'); }} className="dp-control-filtro w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500" />
            </div>
          )}
        </div>
        {modo !== 'recepcion' && <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>{filtradas.length} cita{filtradas.length === 1 ? '' : 's'} visible{filtradas.length === 1 ? '' : 's'}</span>
          {(busqueda || estadoFiltro !== 'todos' || rangoFecha !== 'todas' || fechaExacta) && <button type="button" onClick={() => { setBusqueda(''); setEstadoFiltro('todos'); setRangoFecha('todas'); setFechaExacta(''); }} className="font-black text-cyan-300 hover:text-cyan-200">Limpiar filtros</button>}
        </div>}
      </div>

      {modo === 'recepcion' && <>
        <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
          <button type="button" onClick={() => setFechaRecepcion(fechaLocal(new Date(fechaDesdeTexto(fechaRecepcion).getTime() - 86400000)))} className="rounded-lg border border-slate-700 p-2 text-slate-300"><ChevronLeft size={17} /></button>
          <div className="text-center"><div className="text-xs font-bold uppercase text-cyan-400">Recepción del día</div><input type="date" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} className="mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white" /></div>
          <button type="button" onClick={() => setFechaRecepcion(fechaLocal(new Date(fechaDesdeTexto(fechaRecepcion).getTime() + 86400000)))} className="rounded-lg border border-slate-700 p-2 text-slate-300"><ChevronRight size={17} /></button>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          <Columna titulo="Programadas" estado="pendiente" citas={columnas.pendiente} callbacks={callbacks} onDetalle={setDetalle} arrastre={arrastre} />
          <Columna titulo="En espera" estado="en_espera" citas={columnas.en_espera} callbacks={callbacks} onDetalle={setDetalle} arrastre={arrastre} />
          <Columna titulo="En atención" estado="en_atencion" citas={columnas.en_atencion} callbacks={callbacks} onDetalle={setDetalle} arrastre={arrastre} />
          <Columna titulo="Finalizadas" estado="completada" citas={columnas.completada} callbacks={callbacks} onDetalle={setDetalle} arrastre={arrastre} />
        </div>
      </>}

      {modo === 'calendario' && <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 shadow-xl">
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 md:flex-row md:items-center md:justify-between">
          <div><div className="flex items-center gap-2 font-bold text-white"><CalendarCheck2 size={18} className="text-cyan-400" />Calendario clínico</div><div className="mt-1 text-xs text-slate-500">Mueve la tarjeta para cambiar día y hora. Arrastra el borde inferior para cambiar la duración.</div></div>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold ${edicionHorarios ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400'}`}>
            <input type="checkbox" checked={edicionHorarios} onChange={(e) => { setEdicionHorarios(e.target.checked); if (e.target.checked && vista === 'month') setVista('week'); }} className="accent-emerald-500" />
            {edicionHorarios ? <Unlock size={15} /> : <Lock size={15} />}Editar horarios
          </label>
        </div>
        <div className="mb-4"><LeyendaEstados /></div>
        {edicionHorarios && vista !== 'month' ? (
          <LimiteErrorCalendario fallback={fallbackCalendario}>
            <Suspense fallback={<div className="flex h-[720px] items-center justify-center text-sm text-slate-400">Cargando calendario interactivo...</div>}>
              <CalendarioDnD {...calendarioComun} selectable={false} draggableAccessor={(event) => ACTIVAS.has(event.citaData?.estado)} resizable resizableAccessor={(event) => ACTIVAS.has(event.citaData?.estado)} onEventDrop={guardarCambioHorario} onEventResize={guardarCambioHorario} popup />
            </Suspense>
          </LimiteErrorCalendario>
        ) : <Calendar {...calendarioComun} />}
      </section>}

      {modo === 'resumen' && <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-black text-white">Resumen de citas</h2><p className="text-xs text-slate-500">Los indicadores y la relación inferior responden a los filtros seleccionados.</p></div><span className="text-xs font-black text-cyan-300">{filtradas.length} resultados</span></div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {['pendiente', 'en_espera', 'en_atencion', 'completada', 'no_asistio', 'cancelada'].map((estado) => <div key={estado} className="dp-resumen-indicador rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div className="text-[10px] uppercase text-slate-500">{ESTADOS[estado].texto}</div><div className="mt-1 text-2xl font-black" style={{ color: ESTADOS[estado].color }}>{filtradas.filter((c) => estadoVisual(c.estado) === estado).length}</div></div>)}
        </div>
        <div className="space-y-2">{[...filtradas].sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`)).map((cita) => <button key={cita.id} type="button" onClick={() => setDetalle(cita)} className="dp-resumen-fila grid w-full min-w-0 gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-left sm:grid-cols-[120px_minmax(0,1fr)_150px]"><span className="text-xs font-bold text-cyan-300">{cita.fecha}<br />{cita.hora} - {horaFin(cita)}</span><span><span className="font-bold text-white">{cita.nombrePaciente}</span><span className="mt-1 block text-xs text-slate-400">{servicios(cita).map((s) => s.nombre).join(' + ')}</span></span><span className="text-right text-xs" style={{ color: ESTADOS[estadoVisual(cita.estado)].color }}>{ESTADOS[estadoVisual(cita.estado)].texto}</span></button>)}</div>
      </section>}

      <DetalleRapido cita={detalle} onClose={() => setDetalle(null)} callbacks={callbacks} />

      <style>{`
        .dp-evento-interactivo { position: relative; width: 100%; height: 100%; min-height: 100%; }
        .dp-evento-interactivo.dp-puede-mover { cursor: grab; touch-action: none; }
        .dp-evento-interactivo.dp-puede-mover:active { cursor: grabbing; }
        .dp-agenda-profesional .rbc-event { padding: 0 !important; }
        .dp-agenda-profesional .rbc-event-label { display: none !important; }
        .dp-agenda-profesional .rbc-event-content { height: 100% !important; min-height: 100% !important; }
        .dp-control-duracion { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; height: 12px; cursor: ns-resize; display: flex; align-items: flex-end; justify-content: center; background: transparent; border: 0; padding: 0; touch-action: none; }
        .dp-control-duracion span { width: 34px; height: 4px; margin-bottom: 1px; border-radius: 999px; background: rgba(255,255,255,.92); box-shadow: 0 1px 4px rgba(0,0,0,.35); }
        .dp-sombra-destino { animation: dp-pulso-destino .75s ease-in-out infinite alternate; }
        @keyframes dp-pulso-destino { from { opacity: .65; } to { opacity: 1; } }
        .rbc-today { box-shadow: inset 0 0 0 2px rgba(6,182,212,.35); }
        .rbc-month-view .rbc-date-cell.rbc-now button::after { content: ' HOY'; margin-left: 5px; font-size: 9px; color: #22d3ee; font-weight: 900; }

        html[data-theme="light"] .dp-agenda-profesional .dp-barra-agenda,
        html[data-theme="light"] .dp-agenda-profesional .dp-leyenda-calendario,
        html[data-theme="light"] .dp-agenda-profesional .dp-resumen-indicador,
        html[data-theme="light"] .dp-agenda-profesional .dp-resumen-fila {
          background: #ffffff !important;
          border-color: #C5D0E0 !important;
          box-shadow: 0 5px 16px rgba(40,54,82,.07);
        }
        html[data-theme="light"] .dp-agenda-profesional .dp-control-filtro {
          background: #ffffff !important;
          color: #283652 !important;
          border-color: #B7C4D8 !important;
          box-shadow: inset 0 1px 2px rgba(40,54,82,.04);
        }
        html[data-theme="light"] .dp-agenda-profesional .dp-control-filtro:focus {
          border-color: #56759E !important;
          box-shadow: 0 0 0 3px rgba(86,117,158,.15);
        }
        html[data-theme="light"] .dp-agenda-profesional .text-slate-500,
        html[data-theme="light"] .dp-agenda-profesional .text-slate-600 {
          color: #5E7191 !important;
        }
        html[data-theme="light"] .dp-agenda-profesional .text-slate-300,
        html[data-theme="light"] .dp-agenda-profesional .text-slate-400 {
          color: #425A7D !important;
        }
        html[data-theme="light"] .dp-agenda-profesional .rbc-label,
        html[data-theme="light"] .dp-agenda-profesional .rbc-time-gutter,
        html[data-theme="light"] .dp-agenda-profesional .rbc-date-cell,
        html[data-theme="light"] .dp-agenda-profesional .rbc-button-link {
          color: #283652 !important;
        }
        html[data-theme="light"] .dp-agenda-profesional .rbc-time-slot {
          color: #56759E !important;
        }
        html[data-theme="light"] .dp-agenda-profesional .dp-tarjeta-calendario {
          background-color: color-mix(in srgb, var(--dp-event-color) 24%, white) !important;
          color: #283652 !important;
          box-shadow: 0 4px 11px rgba(40,54,82,.14) !important;
        }
        html[data-theme="light"] .dp-agenda-profesional .dp-evento-calendario,
        html[data-theme="light"] .dp-agenda-profesional .dp-evento-calendario * {
          color: #283652 !important;
        }
      `}</style>
    </div>
  );
}
