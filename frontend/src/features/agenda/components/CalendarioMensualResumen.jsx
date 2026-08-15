import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  format,
  getDay,
  parse,
  startOfWeek as startOfWeekDateFns
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';

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

const ESTADOS_CALENDARIO = {
  pendiente: {
    texto: 'Programada',
    plural: 'Programadas',
    color: '#f59e0b'
  },
  en_espera: {
    texto: 'En espera',
    plural: 'En espera',
    color: '#8b5cf6'
  },
  en_atencion: {
    texto: 'En atención',
    plural: 'En atención',
    color: '#f43f5e'
  },
  completada: {
    texto: 'Finalizada',
    plural: 'Finalizadas',
    color: '#10b981'
  },
  no_asistio: {
    texto: 'No asistió',
    plural: 'No asistieron',
    color: '#ea580c'
  },
  cancelada: {
    texto: 'Cancelada',
    plural: 'Canceladas',
    color: '#64748b'
  }
};

const estadoVisualCalendario = (estado) => (
  estado === 'confirmada' ? 'pendiente' : (estado || 'pendiente')
);

const fechaDesdeTexto = (texto) => {
  const [year, month, day] = String(texto || '').split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day, 12, 0, 0);
};

const crearResumenMensual = (citas = []) => {
  const porFecha = new Map();

  citas.forEach((cita) => {
    if (!fechaDesdeTexto(cita.fecha)) return;

    if (!porFecha.has(cita.fecha)) {
      porFecha.set(cita.fecha, {
        pendiente: 0,
        en_espera: 0,
        en_atencion: 0,
        completada: 0,
        no_asistio: 0,
        cancelada: 0,
        planTratamiento: 0
      });
    }

    const estado = estadoVisualCalendario(cita.estado);
    if (porFecha.get(cita.fecha)[estado] !== undefined) {
      porFecha.get(cita.fecha)[estado] += 1;
    }
    if (cita.planId || cita.sesionPlanId || cita.tipoCita === 'sesion_tratamiento') {
      porFecha.get(cita.fecha).planTratamiento += 1;
    }
  });

  return [...porFecha.entries()].map(([fecha, conteos]) => {
    const inicio = fechaDesdeTexto(fecha);

    return {
      id: `resumen-${fecha}`,
      title: 'Resumen diario',
      start: inicio,
      // Un final dentro del mismo día evita que el resumen invada la celda siguiente.
      end: new Date(inicio.getTime() + 1000),
      allDay: true,
      esResumen: true,
      conteos
    };
  });
};

function ToolbarMensual({
  label,
  onNavigate,
  onCambiarVista,
  mostrarVistas
}) {
  return (
    <div className="dp-month-toolbar mb-4 flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate('TODAY')}
          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-300"
        >
          Hoy
        </button>

        <div className="flex overflow-hidden rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => onNavigate('PREV')}
            aria-label="Mes anterior"
            className="border-r border-slate-700 p-2.5 text-slate-300 hover:bg-slate-800"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('NEXT')}
            aria-label="Mes siguiente"
            className="p-2.5 text-slate-300 hover:bg-slate-800"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="min-w-[150px] text-sm font-black capitalize text-white">
          {label}
        </div>
      </div>

      {mostrarVistas ? (
        <div className="flex rounded-xl border border-slate-700 bg-slate-900 p-1">
          {[
            ['month', 'Mes'],
            ['week', 'Semana'],
            ['day', 'Día']
          ].map(([vista, texto]) => (
            <button
              key={vista}
              type="button"
              onClick={() => onCambiarVista?.(vista)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                vista === 'month'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      ) : (
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
          Vista mensual
        </span>
      )}
    </div>
  );
}

function ResumenDia({ event }) {
  const orden = [
    'pendiente',
    'en_espera',
    'en_atencion',
    'completada',
    'no_asistio',
    'cancelada'
  ];

  return (
    <div className="space-y-1 py-0.5">
      {event.conteos.planTratamiento > 0 && (
        <div className="dp-month-status flex items-center gap-1 rounded bg-violet-500/15 px-1 py-0.5 text-[10px] font-bold text-violet-300">
          <Layers size={10} />
          <span className="truncate">{event.conteos.planTratamiento} {event.conteos.planTratamiento === 1 ? 'sesión de plan' : 'sesiones de plan'}</span>
        </div>
      )}
      {orden
        .filter((estado) => event.conteos[estado])
        .map((estado) => {
          const cantidad = event.conteos[estado];
          const info = ESTADOS_CALENDARIO[estado];

          return (
            <div
              key={estado}
              className="dp-month-status flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-bold"
              style={{
                color: info.color,
                backgroundColor: `${info.color}16`
              }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: info.color }}
              />
              <span className="truncate">
                {cantidad} {cantidad === 1 ? info.texto : info.plural}
              </span>
            </div>
          );
        })}
    </div>
  );
}

export default function CalendarioMensualResumen({
  citas = [],
  fecha,
  onCambiarFecha,
  onSeleccionarFecha,
  onCambiarVista,
  mostrarVistas = false,
  altura = 640
}) {
  const eventos = useMemo(() => crearResumenMensual(citas), [citas]);
  const fechaVisible = fecha || new Date();

  const seleccionar = (valor) => {
    const fechaSeleccionada = valor?.start || valor;
    if (fechaSeleccionada instanceof Date) {
      onSeleccionarFecha?.(fechaSeleccionada);
    }
  };

  return (
    <div className="dp-month-summary-calendar">
      <Calendar
        localizer={localizer}
        culture="es"
        events={eventos}
        startAccessor="start"
        endAccessor="end"
        view="month"
        date={fechaVisible}
        onNavigate={(nuevaFecha) => onCambiarFecha?.(nuevaFecha)}
        views={['month']}
        selectable
        onSelectSlot={seleccionar}
        onSelectEvent={seleccionar}
        onDrillDown={seleccionar}
        eventPropGetter={() => ({
          style: {
            background: 'transparent',
            border: 0,
            padding: 0,
            color: 'inherit'
          }
        })}
        components={{
          toolbar: (props) => (
            <ToolbarMensual
              {...props}
              mostrarVistas={mostrarVistas}
              onCambiarVista={onCambiarVista}
            />
          ),
          event: ResumenDia
        }}
        formats={{
          weekdayFormat: (valor) => format(valor, 'EEEE', { locale: es }),
          monthHeaderFormat: (valor) => format(valor, 'MMMM yyyy', { locale: es })
        }}
        messages={{
          today: 'Hoy',
          previous: 'Anterior',
          next: 'Siguiente',
          month: 'Mes',
          showMore: (total) => `+${total} estados`
        }}
        style={{ height: altura }}
      />
    </div>
  );
}
