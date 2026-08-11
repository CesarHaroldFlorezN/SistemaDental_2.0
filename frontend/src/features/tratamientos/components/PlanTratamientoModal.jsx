import { useEffect, useState } from 'react';
import { CreditCard, DollarSign, FolderKanban, Layers, Save, User, X } from 'lucide-react';

const crearEstado = (plan, pacientes) => ({
  pacienteId: plan?.pacienteId || pacientes[0]?.id || '',
  casoClinicoId: plan?.casoClinicoId || '',
  nombre: plan?.nombre || '',
  tipo: plan?.tipo || 'Endodoncia',
  duracion: plan?.duracion || '3 meses',
  costo: plan?.costo ?? '',
  nSesiones: plan?.nSesiones || 3,
  descripcion: plan?.descripcion || '',
  estado: plan?.estado || 'activo',
  crearPlanPago: false
});

export default function PlanTratamientoModal({
  isOpen,
  onClose,
  onSave,
  planEditar,
  pacientes = [],
  casosClinicos = []
}) {
  const [formData, setFormData] = useState(() => crearEstado(planEditar, pacientes));
  const [guardando, setGuardando] = useState(false);
  const esEdicion = Boolean(planEditar?.id);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(crearEstado(planEditar, pacientes));
    setGuardando(false);
  }, [isOpen, planEditar, pacientes]);

  if (!isOpen) return null;

  const casosPaciente = casosClinicos.filter(
    (caso) => Number(caso.pacienteId) === Number(formData.pacienteId)
      && !caso.planId
      && !['resuelto', 'cerrado'].includes(caso.estado)
  );
  const cantidadSesiones = Math.max(1, Number.parseInt(formData.nSesiones, 10) || 1);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'pacienteId' ? { casoClinicoId: '' } : {})
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.pacienteId || !formData.nombre.trim()) return;
    const payload = {
      pacienteId: Number(formData.pacienteId),
      casoClinicoId: Number(formData.casoClinicoId) || null,
      nombre: formData.nombre.trim(),
      tipo: formData.tipo,
      duracion: formData.duracion,
      costo: Math.max(0, Number(formData.costo) || 0),
      nSesiones: cantidadSesiones,
      descripcion: formData.descripcion.trim(),
      estado: formData.estado
    };

    try {
      setGuardando(true);
      await onSave(payload, planEditar?.id, {
        abrirPlanPago: !esEdicion && formData.crearPlanPago && payload.costo > 0
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-purple-400"><FolderKanban size={20} />{esEdicion ? 'Editar plan de tratamiento' : 'Crear plan de tratamiento'}</h2>
            <p className="mt-1 text-xs text-slate-500">Se crearán desde ahora todas las sesiones y la deuda total del plan.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><User size={15} className="text-purple-400" />Paciente *</span>
              <select name="pacienteId" required disabled={esEdicion} value={formData.pacienteId} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500 disabled:opacity-60"><option value="">Selecciona un paciente</option>{pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.codigo_ficha ? `[${paciente.codigo_ficha}] ` : ''}{paciente.nombre}</option>)}</select>
            </label>
            <label className="font-medium text-slate-300">Caso diagnosticado
              <select name="casoClinicoId" disabled={esEdicion} value={formData.casoClinicoId} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500 disabled:opacity-60"><option value="">Crear un caso nuevo para este plan</option>{casosPaciente.map((caso) => <option key={caso.id} value={caso.id}>{caso.titulo}</option>)}</select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="font-medium text-slate-300">Nombre del plan *<input type="text" name="nombre" required value={formData.nombre} onChange={handleChange} placeholder="Ej.: Endodoncia pieza 26" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-semibold text-white outline-none focus:border-purple-500" /></label>
            <label className="font-medium text-slate-300">Especialidad / tipo<select name="tipo" value={formData.tipo} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500"><option>Endodoncia</option><option>Ortodoncia</option><option>Rehabilitación</option><option>Implantología</option><option>Periodoncia</option><option>Otro</option></select></label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="font-medium text-slate-300">Duración estimada<select name="duracion" value={formData.duracion} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500"><option>1 mes</option><option>3 meses</option><option>6 meses</option><option>1 año</option><option>2 años</option></select></label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1"><DollarSign size={14} className="text-purple-400" />Costo total (S/.)</span><input type="number" min="0" step="0.01" name="costo" value={formData.costo} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-bold text-white outline-none focus:border-purple-500" /></label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1"><Layers size={14} className="text-purple-400" />Número de sesiones</span><input type="number" min="1" max="60" name="nSesiones" value={formData.nSesiones} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-semibold text-white outline-none focus:border-purple-500" /></label>
          </div>

          <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-300">Vista previa de sesiones</div>
            <div className="flex flex-wrap gap-2">{Array.from({ length: Math.min(cantidadSesiones, 20) }, (_, indice) => <span key={indice} className="flex h-9 min-w-9 items-center justify-center rounded-full border border-purple-500/40 bg-slate-900 px-2 text-xs font-black text-purple-200">{indice + 1}</span>)}{cantidadSesiones > 20 && <span className="self-center text-xs text-slate-400">+ {cantidadSesiones - 20} más</span>}</div>
            <p className="mt-3 text-xs text-slate-400">Estas sesiones aparecerán inmediatamente como pendientes. Al agendarlas, el sistema seleccionará el siguiente número disponible y evitará superar el total.</p>
          </div>

          <label className="block font-medium text-slate-300">Descripción, diagnóstico u objetivos<textarea name="descripcion" rows="3" value={formData.descripcion} onChange={handleChange} placeholder="Fases, objetivos clínicos e indicaciones..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500" /></label>

          {!esEdicion && Number(formData.costo) > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4">
              <input type="checkbox" name="crearPlanPago" checked={formData.crearPlanPago} onChange={handleChange} className="mt-1 h-4 w-4 accent-cyan-500" />
              <CreditCard size={18} className="mt-0.5 shrink-0 text-cyan-400" />
              <span><strong className="text-cyan-100">Crear también el cronograma de pagos</strong><span className="mt-1 block text-xs text-slate-400">Se abrirá con el paciente, el costo y {cantidadSesiones} cuotas —una por sesión— ya completados.</span></span>
            </label>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-5 py-2.5 font-medium text-slate-200 hover:bg-slate-600">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 font-semibold text-white hover:bg-purple-500 disabled:opacity-50"><Save size={18} />{guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear plan y sesiones'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
