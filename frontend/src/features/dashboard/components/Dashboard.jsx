import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarPlus,
  CheckCircle,
  Clock,
  Sparkles,
  XCircle
} from 'lucide-react';
import CalendarioMensualResumen from '../../agenda/components/CalendarioMensualResumen.jsx';

const obtenerFechaLocal = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

function EncabezadoDashboard({ onNuevaCita }) {
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(new Date()), 30000);
    return () => window.clearInterval(intervalo);
  }, []);

  const diaSemana = ahora
    .toLocaleDateString('es-PE', { weekday: 'long' })
    .toUpperCase();
  const fechaCompleta = ahora
    .toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
    .toUpperCase();
  const hora = ahora.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <header className="dp-dashboard-hero relative mb-8 overflow-hidden rounded-[28px] border p-6 shadow-2xl sm:p-8 xl:p-10">
      <span className="dp-dashboard-orbit dp-dashboard-orbit-one" aria-hidden="true" />
      <span className="dp-dashboard-orbit dp-dashboard-orbit-two" aria-hidden="true" />

      <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="dp-dashboard-eyebrow inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]">
              <Sparkles size={13} />
              Centro de Mando
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
              Operación clínica en tiempo real
            </span>
          </div>

          <h1 className="dp-dashboard-weekday truncate font-black uppercase leading-none text-white">
            {diaSemana}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-white/80">
            <span className="text-xs font-black tracking-[0.18em] sm:text-sm">
              {fechaCompleta}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-white/50 sm:block" />
            <span
              className="font-serif text-2xl font-black tabular-nums text-white sm:text-3xl"
              aria-live="polite"
            >
              {hora}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left backdrop-blur-md xl:text-right">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/55">
              Estado del sistema
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-bold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
              Agenda sincronizada
            </div>
          </div>

          <button
            type="button"
            onClick={onNuevaCita}
            className="dp-dashboard-primary-action flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5"
          >
            <CalendarPlus size={18} />
            Agendar Cita
          </button>
        </div>
      </div>
    </header>
  );
}

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
          <AlertCircle size={13} /> Programada
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
          <AlertCircle size={13} /> Programada
        </span>
      );
  }
};

export default function Dashboard({
  pacientes = [],
  citas = [],
  pagos = [],
  rolUsuario = 'administrador',
  onCambiarVista,
  onVerCobrosPendientes,
  onNuevaCita,
  onAbrirCompletar,
  onCambiarEstadoCita
}) {
  const [fechaCalendario, setFechaCalendario] = useState(new Date());
  const hoyStr = obtenerFechaLocal();
  const puedeVerFinanzas = ['administrador', 'recepcion'].includes(
    rolUsuario
  );

  const citasHoy = citas.filter(
    (cita) => cita.fecha === hoyStr && cita.estado !== 'cancelada'
  );

  const citasEnAtencion = citas.filter(
    (cita) => cita.estado === 'en_atencion'
  );

  const pacientesConDeuda = pagos.filter(
    (pago) => Number.parseFloat(pago.saldo || 0) > 0
  );

  const pacientesSinVisitaReciente = pacientes.filter((paciente) => {
    const ultimaCita = citas
      .filter(
        (cita) =>
          cita.pacienteId === paciente.id && cita.estado === 'completada'
      )
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];

    if (!ultimaCita?.fecha) {
      return true;
    }

    const diasTranscurridos =
      (new Date() - new Date(`${ultimaCita.fecha}T12:00:00`)) /
      (1000 * 60 * 60 * 24);

    return diasTranscurridos > 180;
  });

  const abrirCobrosPendientes = () => {
    if (onVerCobrosPendientes) {
      onVerCobrosPendientes();
      return;
    }
    onCambiarVista('finanzas');
  };

  return (
    <div className="dp-dashboard">
      <EncabezadoDashboard onNuevaCita={onNuevaCita} />

      <div className={`mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 ${puedeVerFinanzas ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <button
          type="button"
          onClick={() => onCambiarVista('pacientes')}
          className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-cyan-500"
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pacientes Totales
          </div>
          <div className="font-serif text-2xl font-bold text-white">
            {pacientes.length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onCambiarVista('citas')}
          className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-cyan-500"
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Citas para Hoy
          </div>
          <div className="font-serif text-2xl font-bold text-cyan-400">
            {citasHoy.length}
          </div>
        </button>

        {puedeVerFinanzas && (
          <button
            type="button"
            onClick={abrirCobrosPendientes}
            className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-cyan-500"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cuentas por Cobrar
            </div>
            <div className="font-serif text-2xl font-bold text-rose-400">
              {pacientesConDeuda.length}
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => onCambiarVista('pacientes')}
          className="cursor-pointer rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-cyan-500"
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
                      type="button"
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
                type="button"
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
                        <div className="text-xs font-bold">{cita.hora || '—'}</div>
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
                          type="button"
                          onClick={() =>
                            onCambiarEstadoCita(cita, 'en_atencion')
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
                type="button"
                onClick={abrirCobrosPendientes}
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
                type="button"
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

        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-800/80 p-4 shadow-xl sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-cyan-400">
              <CalendarDays size={18} />
              Calendario mensual
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Resumen diario de citas por estado, en una vista completa del mes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onCambiarVista('citas')}
            className="w-max text-xs font-bold text-cyan-400 hover:underline"
          >
            Abrir agenda completa →
          </button>
        </div>

        <CalendarioMensualResumen
          citas={citas}
          fecha={fechaCalendario}
          onCambiarFecha={setFechaCalendario}
          altura={650}
        />
      </section>
    </div>
  );
}
