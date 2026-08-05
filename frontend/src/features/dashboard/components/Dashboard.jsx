import {
  AlertCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

const obtenerFechaLocal = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const BadgeEstado = ({ estado }) => {
  switch ((estado || '').toLowerCase()) {
    case 'completada':
      return (
        <span className="flex w-max items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          <CheckCircle size={13} /> Atendida
        </span>
      );

    case 'en_atencion':
      return (
        <span className="flex w-max animate-pulse items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
          <Clock size={13} /> En atención 🔴
        </span>
      );

    case 'en_espera':
      return (
        <span className="flex w-max items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-400">
          <Clock size={13} /> En espera
        </span>
      );

    case 'confirmada':
      return (
        <span className="flex w-max items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
          <AlertCircle size={13} /> Programado
        </span>
      );

    case 'no_asistio':
      return (
        <span className="flex w-max items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-400">
          <AlertCircle size={13} /> No asistió
        </span>
      );

    case 'cancelada':
      return (
        <span className="flex w-max items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-400">
          <XCircle size={13} /> Cancelada
        </span>
      );

    default:
      return (
        <span className="flex w-max items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
          <AlertCircle size={13} /> Programado
        </span>
      );
  }
};

export default function Dashboard({
  pacientes = [],
  citas = [],
  pagos = [],
  onCambiarVista,
  onNuevaCita,
  onAbrirCompletar,
  onCambiarEstadoCita
}) {
  const hoyStr = obtenerFechaLocal();

  const mananaDate = new Date();
  mananaDate.setDate(mananaDate.getDate() + 1);

  const mananaStr = obtenerFechaLocal(mananaDate);

  const citasHoy = citas.filter(
    (cita) =>
      cita.fecha === hoyStr &&
      cita.estado !== 'cancelada'
  );

  const citasManana = citas.filter(
    (cita) =>
      cita.fecha === mananaStr &&
      cita.estado !== 'cancelada'
  );

  const citasEnAtencion = citas.filter(
    (cita) => cita.estado === 'en_atencion'
  );

  const pacientesConDeuda = pagos.filter(
    (pago) => Number.parseFloat(pago.saldo || 0) > 0
  );

  const pacientesSinVisitaReciente = pacientes.filter(
    (paciente) => {
      const ultimaCita = citas
        .filter(
          (cita) =>
            cita.pacienteId === paciente.id &&
            cita.estado === 'completada'
        )
        .sort((a, b) =>
          (b.fecha || '').localeCompare(a.fecha || '')
        )[0];

      if (!ultimaCita?.fecha) {
        return true;
      }

      const diasTranscurridos =
        (new Date() -
          new Date(`${ultimaCita.fecha}T12:00:00`)) /
        (1000 * 60 * 60 * 24);

      return diasTranscurridos > 180;
    }
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            Centro de Mando
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        <button
          onClick={onNuevaCita}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500"
        >
          <CalendarPlus size={18} />
          Agendar Cita
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => onCambiarVista('pacientes')}
          className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:border-cyan-500"
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pacientes Totales
          </div>
          <div className="font-serif text-2xl font-bold text-white">
            {pacientes.length}
          </div>
        </button>

        <button
          onClick={() => onCambiarVista('citas')}
          className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:border-cyan-500"
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Citas para Hoy
          </div>
          <div className="font-serif text-2xl font-bold text-cyan-400">
            {citasHoy.length}
          </div>
        </button>

        <button
          onClick={() => onCambiarVista('finanzas')}
          className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:border-cyan-500"
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Cuentas por Cobrar
          </div>
          <div className="font-serif text-2xl font-bold text-rose-400">
            {pacientesConDeuda.length}
          </div>
        </button>

        <button
          onClick={() => onCambiarVista('pacientes')}
          className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:border-cyan-500"
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sin Visita (+6 Meses)
          </div>
          <div className="font-serif text-2xl font-bold text-amber-400">
            {pacientesSinVisitaReciente.length}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500/40 bg-slate-800/80 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-rose-400">
                <span className="h-3 w-3 animate-pulse rounded-full bg-rose-500" />
                Pacientes en Atención 🔴
              </h3>

              <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
                {citasEnAtencion.length} en sillón
              </span>
            </div>

            <div className="space-y-3">
              {citasEnAtencion.length > 0 ? (
                citasEnAtencion.map((cita) => (
                  <div
                    key={cita.id}
                    className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-slate-900/80 p-4"
                  >
                    <div>
                      <div className="text-base font-bold text-white">
                        {cita.nombrePaciente}
                      </div>

                      <div className="mt-0.5 text-xs font-medium text-rose-300">
                        🩺 {cita.procedimiento || 'Tratamiento en curso'}
                      </div>

                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={12} />
                        Inicio: {cita.hora || '09:00'}
                      </div>
                    </div>

                    <button
                      onClick={() => onAbrirCompletar(cita)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-emerald-500"
                    >
                      <CheckCircle size={15} />
                      Completar
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 py-6 text-center text-xs text-slate-500">
                  Ningún paciente en atención.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-cyan-400">
                <CalendarIcon size={18} />
                Agenda de Hoy
              </h3>

              <button
                onClick={() => onCambiarVista('citas')}
                className="cursor-pointer text-xs font-medium text-cyan-400 hover:underline"
              >
                Ver todas →
              </button>
            </div>

            <div className="space-y-2.5">
              {citasHoy.length > 0 ? (
                citasHoy.map((cita) => (
                  <div
                    key={cita.id}
                    className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/60 p-3.5 transition hover:border-cyan-500/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-16 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-center text-cyan-400">
                        <div className="text-xs font-bold">
                          {cita.hora || '—'}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-white">
                          {cita.nombrePaciente}
                        </div>
                        <div className="text-xs text-slate-400">
                          {cita.procedimiento || 'Consulta'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <BadgeEstado estado={cita.estado} />

                      {cita.estado === 'pendiente' && (
                        <button
                          onClick={() =>
                            onCambiarEstadoCita(
                              cita,
                              'en_atencion'
                            )
                          }
                          className="cursor-pointer rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
                        >
                          ▶ Atender
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-900/30 py-8 text-center text-sm text-slate-400">
                  No hay más citas programadas para hoy.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-6 shadow-xl">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-amber-400">
              <AlertTriangle size={18} />
              Alertas Inteligentes
            </h3>

            <div className="space-y-3">
              <button
                onClick={() => onCambiarVista('finanzas')}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left transition hover:bg-rose-500/15"
              >
                <div>
                  <div className="text-sm font-bold text-rose-400">
                    Cobros Pendientes
                  </div>
                  <div className="mt-0.5 text-xs text-slate-300">
                    {pacientesConDeuda.length} pacientes con saldo por cobrar
                  </div>
                </div>

                <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white">
                  {pacientesConDeuda.length}
                </span>
              </button>

              <button
                onClick={() => onCambiarVista('pacientes')}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left transition hover:bg-amber-500/15"
              >
                <div>
                  <div className="text-sm font-bold text-amber-400">
                    Seguimiento Preventivo
                  </div>
                  <div className="mt-0.5 text-xs text-slate-300">
                    {pacientesSinVisitaReciente.length} pacientes sin consulta en +6 meses
                  </div>
                </div>

                <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">
                  {pacientesSinVisitaReciente.length}
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-200">
                <CalendarIcon
                  size={18}
                  className="text-slate-400"
                />
                Citas para Mañana
              </h3>

              <span className="text-xs font-medium text-slate-400">
                {mananaDate.toLocaleDateString('es-PE', {
                  day: 'numeric',
                  month: 'short'
                })}
              </span>
            </div>

            <div className="space-y-2.5">
              {citasManana.length > 0 ? (
                citasManana.map((cita) => (
                  <div
                    key={cita.id}
                    className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-slate-700/60 px-3 py-1 text-xs font-bold text-slate-300">
                        {cita.hora || '—'}
                      </div>

                      <div className="text-sm font-semibold text-white">
                        {cita.nombrePaciente}
                      </div>
                    </div>

                    <BadgeEstado estado={cita.estado} />
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-900/30 py-8 text-center text-sm text-slate-500">
                  No hay citas agendadas para mañana.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}