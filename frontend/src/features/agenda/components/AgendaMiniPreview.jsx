import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, Layers } from 'lucide-react';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const fechaLocal = (fecha) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const desdeTexto = (texto) => {
  const [year, month, day] = String(texto || '').split('-').map(Number);
  return year && month && day
    ? new Date(year, month - 1, day, 12, 0, 0)
    : new Date();
};

const sumarDias = (fecha, dias) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
};

const inicioSemana = (fecha) => {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() - ((copia.getDay() + 6) % 7));
  return copia;
};

const obtenerPaciente = (cita, pacientes) =>
  pacientes.find((paciente) => Number(paciente.id) === Number(cita.pacienteId));

const esPlan = (cita) => Boolean(
  cita.planId || cita.sesionPlanId || cita.tipoCita === 'sesion_tratamiento'
);

export default function AgendaMiniPreview({
  citas = [],
  pacientes = [],
  fecha,
  hora,
  horaFin,
  citaEditarId
}) {
  const [vista, setVista] = useState('mes');
  const seleccionada = useMemo(() => desdeTexto(fecha), [fecha]);
  const citasActivas = useMemo(
    () => citas.filter((cita) =>
      Number(cita.id) !== Number(citaEditarId)
      && !['cancelada', 'no_asistio'].includes(cita.estado)
    ),
    [citas, citaEditarId]
  );

  const diasMes = useMemo(() => {
    const primero = new Date(
      seleccionada.getFullYear(),
      seleccionada.getMonth(),
      1,
      12
    );
    const inicio = sumarDias(primero, -((primero.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, indice) => sumarDias(inicio, indice));
  }, [seleccionada]);

  const diasSemana = useMemo(() => {
    const inicio = inicioSemana(seleccionada);
    return Array.from({ length: 7 }, (_, indice) => sumarDias(inicio, indice));
  }, [seleccionada]);

  const citasDe = (dia) => citasActivas
    .filter((cita) => cita.fecha === fechaLocal(dia))
    .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

  const propuesta = {
    fecha,
    hora,
    horaFin,
    nombrePaciente: 'Nueva atención',
    estado: 'propuesta'
  };

  const citasDia = [...citasDe(seleccionada), propuesta]
    .filter((cita) => cita.fecha)
    .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

  return (
    <aside className="dp-mini-agenda flex min-h-0 flex-col border-l border-slate-700 bg-slate-950/65 p-4">
      <div className="mb-3">
        <h3 className="flex items-center gap-2 font-black text-white">
          <CalendarDays size={18} className="text-cyan-400" />
          Vista previa de agenda
        </h3>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Solo lectura · ayuda a elegir el horario sin cerrar el formulario.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-3 rounded-xl border border-slate-700 bg-slate-900 p-1">
        {[
          ['mes', 'Mes'],
          ['semana', 'Semana'],
          ['dia', 'Día']
        ].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setVista(valor)}
            className={`rounded-lg px-2 py-2 text-xs font-black ${vista === valor ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2.5 text-xs">
        <div className="font-black text-cyan-200">Horario que estás preparando</div>
        <div className="mt-1 flex items-center gap-1.5 font-bold text-white">
          <Clock3 size={14} /> {fecha || 'Sin fecha'} · {hora || '—'} a {horaFin || '—'}
        </div>
      </div>

      {vista === 'mes' && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
          <div className="mb-3 text-center text-sm font-black capitalize text-white">
            {seleccionada.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DIAS.map((dia) => <div key={dia} className="py-1 text-center text-[10px] font-black text-slate-400">{dia}</div>)}
            {diasMes.map((dia) => {
              const clave = fechaLocal(dia);
              const cantidad = citasDe(dia).length;
              const actual = clave === fecha;
              const mismoMes = dia.getMonth() === seleccionada.getMonth();
              return (
                <div key={clave} className={`min-h-11 rounded-lg border p-1 text-center ${actual ? 'border-cyan-400 bg-cyan-500/25 text-white ring-1 ring-cyan-400' : 'border-slate-700/70 bg-slate-950/50'} ${mismoMes ? 'text-slate-200' : 'text-slate-600'}`}>
                  <div className="text-[10px] font-black">{dia.getDate()}</div>
                  {cantidad > 0 && <div className="mx-auto mt-1 w-fit rounded-full bg-violet-600 px-1.5 text-[8px] font-black text-white">{cantidad}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === 'semana' && (
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/70 p-2">
          {diasSemana.map((dia) => {
            const clave = fechaLocal(dia);
            const registros = citasDe(dia);
            return (
              <div key={clave} className={`min-w-0 rounded-lg border p-1.5 ${clave === fecha ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700 bg-slate-950/45'}`}>
                <div className="text-center text-[9px] font-black uppercase text-slate-400">{dia.toLocaleDateString('es-PE', { weekday: 'short' })}</div>
                <div className="text-center text-sm font-black text-white">{dia.getDate()}</div>
                <div className="mt-2 space-y-1">
                  {registros.slice(0, 5).map((cita) => (
                    <div key={cita.id} title={obtenerPaciente(cita, pacientes)?.nombre} className={`truncate rounded px-1 py-1 text-[8px] font-black text-white ${esPlan(cita) ? 'bg-violet-700' : 'bg-sky-700'}`}>
                      {cita.hora}
                    </div>
                  ))}
                  {clave === fecha && <div className="truncate rounded border border-cyan-300 bg-cyan-600 px-1 py-1 text-[8px] font-black text-white">{hora}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === 'dia' && (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="mb-3 text-sm font-black capitalize text-white">
            {seleccionada.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {citasDia.map((cita, indice) => {
            const esPropuesta = cita.estado === 'propuesta';
            const paciente = obtenerPaciente(cita, pacientes);
            return (
              <div key={esPropuesta ? 'propuesta' : cita.id || indice} className={`rounded-xl border p-3 ${esPropuesta ? 'border-cyan-400 bg-cyan-500/20 ring-1 ring-cyan-400/40' : esPlan(cita) ? 'border-violet-500/50 bg-violet-500/15' : 'border-slate-600 bg-slate-950/60'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-white">{cita.hora || '—'} – {cita.horaFin || '—'}</span>
                  {esPlan(cita) && <Layers size={13} className="text-violet-300" />}
                </div>
                <div className="mt-1 truncate text-[11px] font-bold text-slate-300">{esPropuesta ? 'Nueva atención' : paciente?.nombre || 'Paciente'}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 text-center text-[10px] font-semibold text-slate-500">
        Azul: cita normal · Violeta: sesión de tratamiento · Cian: horario nuevo
      </div>
    </aside>
  );
}
