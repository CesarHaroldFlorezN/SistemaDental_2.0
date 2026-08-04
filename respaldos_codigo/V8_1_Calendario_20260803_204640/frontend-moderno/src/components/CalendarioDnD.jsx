import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'react-big-calendar';

const minutos = (fecha) => fecha.getHours() * 60 + fecha.getMinutes();
const sumarMinutos = (fecha, cantidad) => new Date(fecha.getTime() + cantidad * 60000);
const inicioSemana = (fecha) => {
  const valor = new Date(fecha);
  valor.setHours(0, 0, 0, 0);
  const desplazamiento = (valor.getDay() + 6) % 7;
  valor.setDate(valor.getDate() - desplazamiento);
  return valor;
};
const diferenciaDias = (a, b) => Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
const aplicarAccesor = (accesor, event, predeterminado = true) => {
  if (typeof accesor === 'function') return Boolean(accesor(event));
  if (typeof accesor === 'string') return Boolean(event?.[accesor]);
  if (typeof accesor === 'boolean') return accesor;
  return predeterminado;
};

/**
 * Calendario interactivo propio de DentalPro.
 * No usa react-big-calendar/addons/dragAndDrop, evitando findDOMNode y otros
 * problemas de compatibilidad con React 19.
 */
export default function CalendarioDnD({
  components = {},
  draggableAccessor,
  resizableAccessor,
  onEventDrop,
  onEventResize,
  step = 15,
  min = new Date(1970, 0, 1, 7, 0),
  max = new Date(1970, 0, 1, 21, 0),
  view = 'week',
  date = new Date(),
  ...calendarProps
}) {
  const raizRef = useRef(null);
  const interaccionRef = useRef(null);
  const [interaccion, setInteraccion] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [puntero, setPuntero] = useState(null);

  const minMinutos = minutos(min);
  const maxMinutos = minutos(max);
  const rangoMinutos = Math.max(step, maxMinutos - minMinutos);
  const EventoOriginal = components.event;

  const obtenerColumnas = () => Array.from(
    raizRef.current?.querySelectorAll('.rbc-time-content .rbc-day-slot') || []
  ).map((elemento) => ({ elemento, rect: elemento.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);

  const fechaColumna = (indice) => {
    const base = view === 'day' ? new Date(date) : inicioSemana(date);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + indice);
    return base;
  };

  const indiceFecha = (fechaEvento, cantidadColumnas) => {
    if (view === 'day') return 0;
    const indice = diferenciaDias(fechaEvento, inicioSemana(date));
    return Math.max(0, Math.min(cantidadColumnas - 1, indice));
  };

  const minutoDesdeY = (y, rect) => {
    const proporcion = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    const bruto = minMinutos + proporcion * rangoMinutos;
    return Math.round(bruto / step) * step;
  };

  const rectVistaPrevia = (columna, inicio, fin) => ({
    position: 'fixed',
    left: columna.rect.left + 2,
    top: columna.rect.top + ((inicio - minMinutos) / rangoMinutos) * columna.rect.height,
    width: Math.max(10, columna.rect.width - 4),
    height: Math.max(10, ((fin - inicio) / rangoMinutos) * columna.rect.height),
    zIndex: 9998
  });

  useEffect(() => {
    interaccionRef.current = interaccion;
  }, [interaccion]);

  useEffect(() => {
    if (!interaccion) return undefined;

    const mover = (event) => {
      const actual = interaccionRef.current;
      if (!actual || event.pointerId !== actual.pointerId) return;
      event.preventDefault();

      const columnas = obtenerColumnas();
      if (!columnas.length) return;
      const distancia = Math.hypot(event.clientX - actual.xInicial, event.clientY - actual.yInicial);
      const movido = actual.movido || distancia > 4;

      let indice = actual.indiceOriginal;
      if (actual.modo === 'mover') {
        const dentro = columnas.findIndex(({ rect }) => event.clientX >= rect.left && event.clientX <= rect.right);
        if (dentro >= 0) indice = dentro;
        else {
          indice = columnas.reduce((mejor, item, posicion) => {
            const distanciaActual = Math.abs(event.clientX - (item.rect.left + item.rect.width / 2));
            return distanciaActual < mejor.distancia ? { posicion, distancia: distanciaActual } : mejor;
          }, { posicion: 0, distancia: Number.POSITIVE_INFINITY }).posicion;
        }
      }

      const columna = columnas[Math.max(0, Math.min(columnas.length - 1, indice))];
      const duracion = Math.max(step, Math.round((actual.event.end - actual.event.start) / 60000));
      let inicioMinuto;
      let finMinuto;
      let inicioDestino;
      let finDestino;

      if (actual.modo === 'mover') {
        inicioMinuto = minutoDesdeY(event.clientY, columna.rect);
        inicioMinuto = Math.max(minMinutos, Math.min(maxMinutos - duracion, inicioMinuto));
        finMinuto = inicioMinuto + duracion;
        inicioDestino = fechaColumna(indice);
        inicioDestino.setMinutes(inicioMinuto);
        finDestino = sumarMinutos(inicioDestino, duracion);
      } else {
        inicioDestino = new Date(actual.event.start);
        inicioMinuto = minutos(inicioDestino);
        finMinuto = minutoDesdeY(event.clientY, columna.rect);
        finMinuto = Math.max(inicioMinuto + step, Math.min(maxMinutos, finMinuto));
        finDestino = new Date(inicioDestino);
        finDestino.setHours(Math.floor(finMinuto / 60), finMinuto % 60, 0, 0);
      }

      const siguiente = {
        ...actual,
        movido,
        indiceDestino: indice,
        start: inicioDestino,
        end: finDestino
      };
      interaccionRef.current = siguiente;
      setPuntero({ x: event.clientX, y: event.clientY, texto: actual.event.citaData?.nombrePaciente || actual.event.title || 'Cita' });
      setVistaPrevia({ style: rectVistaPrevia(columna, inicioMinuto, finMinuto), start: inicioDestino, end: finDestino, modo: actual.modo });
    };

    const terminar = async (event) => {
      const actual = interaccionRef.current;
      if (!actual || event.pointerId !== actual.pointerId) return;
      event.preventDefault();
      setInteraccion(null);
      interaccionRef.current = null;
      setVistaPrevia(null);
      setPuntero(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (!actual.movido || !actual.start || !actual.end) return;
      const datos = { event: actual.event, start: actual.start, end: actual.end, isAllDay: false };
      try {
        if (actual.modo === 'redimensionar') await onEventResize?.(datos);
        else await onEventDrop?.(datos);
      } catch (error) {
        console.error('DentalPro: no se pudo guardar el cambio de horario.', error);
      }
    };

    window.addEventListener('pointermove', mover, { passive: false });
    window.addEventListener('pointerup', terminar, { passive: false });
    window.addEventListener('pointercancel', terminar, { passive: false });
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', terminar);
      window.removeEventListener('pointercancel', terminar);
    };
  }, [interaccion, date, view, minMinutos, maxMinutos, rangoMinutos, step, onEventDrop, onEventResize]);

  const iniciar = (eventPointer, event, modo) => {
    if (eventPointer.button !== 0) return;
    const permitido = modo === 'redimensionar'
      ? aplicarAccesor(resizableAccessor, event)
      : aplicarAccesor(draggableAccessor, event);
    if (!permitido) return;

    const columnas = obtenerColumnas();
    if (!columnas.length) return;
    eventPointer.preventDefault();
    eventPointer.stopPropagation();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = modo === 'redimensionar' ? 'ns-resize' : 'grabbing';
    const indiceOriginal = indiceFecha(event.start, columnas.length);
    const siguiente = {
      event,
      modo,
      pointerId: eventPointer.pointerId,
      xInicial: eventPointer.clientX,
      yInicial: eventPointer.clientY,
      indiceOriginal,
      indiceDestino: indiceOriginal,
      start: new Date(event.start),
      end: new Date(event.end),
      movido: false
    };
    interaccionRef.current = siguiente;
    setInteraccion(siguiente);
    setPuntero({ x: eventPointer.clientX, y: eventPointer.clientY, texto: event.citaData?.nombrePaciente || event.title || 'Cita' });
  };

  const EventoInteractivo = useMemo(() => function EventoInteractivoInterno(props) {
    const puedeMover = aplicarAccesor(draggableAccessor, props.event);
    const puedeRedimensionar = aplicarAccesor(resizableAccessor, props.event);
    return (
      <div
        className={`dp-evento-interactivo ${puedeMover ? 'dp-puede-mover' : ''}`}
        onPointerDown={(e) => iniciar(e, props.event, 'mover')}
        onClick={(e) => { if (puedeMover) { e.preventDefault(); e.stopPropagation(); } }}
      >
        {EventoOriginal ? <EventoOriginal {...props} /> : <div className="truncate font-bold">{props.title}</div>}
        {puedeRedimensionar && (
          <button
            type="button"
            className="dp-control-duracion"
            aria-label="Cambiar duracion"
            title="Arrastra para cambiar la duracion"
            onPointerDown={(e) => iniciar(e, props.event, 'redimensionar')}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          ><span /></button>
        )}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [EventoOriginal, draggableAccessor, resizableAccessor, date, view]);

  return (
    <div ref={raizRef} className="dp-calendario-interactivo relative">
      <Calendar
        {...calendarProps}
        components={{ ...components, event: EventoInteractivo }}
        step={step}
        min={min}
        max={max}
        view={view}
        date={date}
        selectable={false}
      />

      {vistaPrevia && (
        <div className="dp-sombra-destino pointer-events-none rounded-lg border-2 border-dashed border-cyan-300 bg-cyan-400/25 shadow-2xl" style={vistaPrevia.style}>
          <div className="px-2 py-1 text-[10px] font-black text-white">
            {vistaPrevia.start.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit' })} · {vistaPrevia.start.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} - {vistaPrevia.end.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {puntero && interaccion && (
        <div className="pointer-events-none fixed z-[9999] max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-cyan-300/60 bg-slate-900/95 px-3 py-2 text-xs font-bold text-white shadow-2xl" style={{ left: puntero.x, top: puntero.y }}>
          {puntero.texto}
          <div className="mt-0.5 text-[10px] font-medium text-cyan-300">{interaccion.modo === 'redimensionar' ? 'Cambiando duracion' : 'Moviendo cita'}</div>
        </div>
      )}
    </div>
  );
}
