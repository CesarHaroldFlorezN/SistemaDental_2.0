import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Cake,
  CheckCircle,
  CreditCard,
  Edit3,
  FileText,
  Mail,
  MapPin,
  Phone,
  Pill,
  UserRound,
  X
} from 'lucide-react';

const moneda = (valor) => `S/. ${Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  const [year, month, day] = String(fechaNacimiento).split('-').map(Number);
  if (!year || !month || !day) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - year;
  const antesCumple = hoy.getMonth() + 1 < month || (hoy.getMonth() + 1 === month && hoy.getDate() < day);
  if (antesCumple) edad -= 1;
  return edad >= 0 ? edad : null;
};

const serviciosDeCita = (cita) => Array.isArray(cita?.servicios) && cita.servicios.length
  ? cita.servicios
  : [{ nombre: cita?.procedimiento || 'Consulta', costo: cita?.costo || 0 }];

const badgeEstado = (estado) => {
  const estilos = {
    pendiente: ['Programado', 'border-amber-500/30 bg-amber-500/10 text-amber-300'],
    confirmada: ['Confirmado', 'border-blue-500/30 bg-blue-500/10 text-blue-300'],
    en_espera: ['En espera', 'border-violet-500/30 bg-violet-500/10 text-violet-300'],
    en_atencion: ['En atención', 'border-rose-500/30 bg-rose-500/10 text-rose-300'],
    completada: ['Finalizado', 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'],
    cancelada: ['Cancelado', 'border-slate-500/30 bg-slate-500/10 text-slate-400'],
    no_asistio: ['No asistió', 'border-orange-500/30 bg-orange-500/10 text-orange-300']
  };
  const [texto, clase] = estilos[estado] || estilos.pendiente;
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${clase}`}>{texto}</span>;
};

export default function FichaPacienteModal({
  isOpen,
  onClose,
  paciente,
  citas = [],
  pagos = [],
  onNuevaCita,
  onEditarPaciente
}) {
  if (!isOpen || !paciente) return null;

  const citasPaciente = citas
    .filter((cita) => Number(cita.pacienteId) === Number(paciente.id))
    .sort((a, b) => `${b.fecha || ''}${b.hora || ''}`.localeCompare(`${a.fecha || ''}${a.hora || ''}`));
  const pagosPaciente = pagos.filter((pago) => Number(pago.pacienteId) === Number(paciente.id));
  const totalPagado = pagosPaciente.reduce((total, pago) => total + Number(pago.cobrado || 0), 0);
  const saldoPendiente = pagosPaciente.reduce((total, pago) => total + Number(pago.saldo || 0), 0);
  const edad = calcularEdad(paciente.fechaNacimiento);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onMouseDown={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-900 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-700 bg-slate-800/80 px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-2xl font-black text-cyan-300">{(paciente.nombre || '?').charAt(0)}</div>
            <div className="min-w-0"><div className="text-xs font-bold uppercase tracking-widest text-cyan-400">Ficha clínica rápida</div><h2 className="truncate text-2xl font-black text-white">{paciente.nombre}</h2><div className="mt-1 flex flex-wrap gap-2"><span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm font-black text-cyan-200">Ficha {paciente.codigo_ficha || 'SIN NÚMERO'}</span><span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">DNI {paciente.cedula || '—'}</span></div></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-700 hover:text-white"><X size={21} /></button>
        </header>

        <div className="space-y-5 overflow-y-auto p-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Phone size={15} className="text-cyan-400" />Teléfono</div><div className="mt-2 font-bold text-white">{paciente.telefono || 'No registrado'}</div></div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Mail size={15} className="text-cyan-400" />Correo</div><div className="mt-2 break-all font-semibold text-white">{paciente.correo || 'No registrado'}</div></div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Cake size={15} className="text-cyan-400" />Nacimiento y edad</div><div className="mt-2 font-bold text-white">{paciente.fechaNacimiento || 'No registrado'}</div><div className="text-xs text-slate-400">{edad === null ? 'Edad no disponible' : `${edad} años`}</div></div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><UserRound size={15} className="text-cyan-400" />Género</div><div className="mt-2 font-bold text-white">{paciente.genero || 'No registrado'}</div></div>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><MapPin size={15} className="text-cyan-400" />Dirección</div><div className="mt-2 font-semibold text-white">{paciente.direccion || 'No registrada'}</div></section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${paciente.alergias ? 'border-rose-500/40 bg-rose-500/10' : 'border-slate-700 bg-slate-800/60'}`}><div className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${paciente.alergias ? 'text-rose-300' : 'text-slate-500'}`}><AlertTriangle size={17} />Alergias y antecedentes</div><div className="mt-2 text-sm font-medium text-slate-100">{paciente.alergias || 'Sin alergias o antecedentes registrados.'}</div></div>
            <div className={`rounded-2xl border p-4 ${paciente.medicamentos ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-800/60'}`}><div className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${paciente.medicamentos ? 'text-amber-300' : 'text-slate-500'}`}><Pill size={17} />Medicamentos actuales</div><div className="mt-2 text-sm font-medium text-slate-100">{paciente.medicamentos || 'Sin medicamentos registrados.'}</div></div>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Citas registradas</div><div className="mt-2 text-3xl font-black text-white">{citasPaciente.length}</div></div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total pagado</div><div className="mt-2 text-2xl font-black text-white">{moneda(totalPagado)}</div></div>
            <div className={`rounded-2xl border p-4 ${saldoPendiente > 0 ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}><div className={`text-xs font-bold uppercase tracking-wider ${saldoPendiente > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>Saldo pendiente</div><div className="mt-2 text-2xl font-black text-white">{saldoPendiente > 0 ? moneda(saldoPendiente) : 'Al día'}</div></div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300"><Calendar size={17} className="text-cyan-400" />Historial clínico</h3><span className="text-xs text-slate-500">Últimas atenciones primero</span></div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {citasPaciente.length ? citasPaciente.map((cita) => (
                <article key={cita.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                  <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-slate-400">{cita.fecha || '—'} · {cita.hora || '—'}</div><div className="mt-1 text-sm font-bold text-white">{serviciosDeCita(cita).map((servicio) => servicio.nombre).join(' + ')}</div></div>{badgeEstado(cita.estado)}</div>
                  {cita.notasFin && <div className="mt-3 rounded-xl border border-cyan-500/10 bg-cyan-500/5 p-3 text-xs text-cyan-100">{cita.notasFin}</div>}
                </article>
              )) : <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">Este paciente aún no tiene historial.</div>}
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-700 bg-slate-800/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => onEditarPaciente?.(paciente)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-600"><Edit3 size={16} />Editar datos</button>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-600">Cerrar ficha</button><button type="button" onClick={() => onNuevaCita?.(paciente)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-500"><CalendarPlus size={16} />Programar nueva atención</button></div>
        </footer>
      </div>
    </div>
  );
}
