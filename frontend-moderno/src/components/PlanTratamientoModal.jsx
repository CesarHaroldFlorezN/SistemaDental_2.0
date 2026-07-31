import { useState } from 'react';
import { X, Save, FolderKanban, User, DollarSign, Layers } from 'lucide-react';

export default function PlanTratamientoModal({ isOpen, onClose, onSave, planEditar, pacientes = [] }) {
  const [formData, setFormData] = useState(() => ({
    pacienteId: planEditar?.pacienteId || (pacientes[0]?.id || ''),
    nombre: planEditar?.nombre || 'Ortodoncia Completa',
    tipo: planEditar?.tipo || 'Ortodoncia',
    duracion: planEditar?.duracion || '1 año',
    costo: planEditar?.costo || '',
    nSesiones: planEditar?.nSesiones || 12,
    descripcion: planEditar?.descripcion || '',
    estado: planEditar?.estado || 'activo'
  }));

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.pacienteId || !formData.nombre.trim()) return;

    const payload = {
      pacienteId: parseInt(formData.pacienteId, 10),
      nombre: formData.nombre,
      tipo: formData.tipo,
      duracion: formData.duracion,
      costo: parseFloat(formData.costo) || 0,
      nSesiones: parseInt(formData.nSesiones, 10) || 1,
      descripcion: formData.descripcion,
      estado: formData.estado,
      creadoEn: planEditar?.creadoEn || new Date().toISOString()
    };

    onSave(payload, planEditar?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/80">
          <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2">
            <FolderKanban size={20} />
            {planEditar ? 'Editar Plan de Tratamiento' : 'Crear Plan de Tratamiento'}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          
          {/* Paciente */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <User size={15} className="text-purple-400" />
              Paciente <span className="text-red-400">*</span>
            </label>
            <select
              name="pacienteId"
              required
              disabled={Boolean(planEditar)}
              value={formData.pacienteId}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none transition font-medium disabled:opacity-50"
            >
              <option value="">-- Selecciona un paciente --</option>
              {pacientes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.codigo_ficha ? `[${p.codigo_ficha}] ` : ''}{p.nombre} {p.cedula ? `(DNI: ${p.cedula})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Nombre del Plan *</label>
              <input
                type="text"
                name="nombre"
                required
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Ej: Ortodoncia completa"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none transition font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Especialidad / Tipo</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none transition"
              >
                <option value="Ortodoncia">Ortodoncia</option>
                <option value="Endodoncia">Endodoncia</option>
                <option value="Rehabilitación">Rehabilitación Oral</option>
                <option value="Implantología">Implantes</option>
                <option value="Otro">Otro tratamiento</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Duración Estimada</label>
              <select
                name="duracion"
                value={formData.duracion}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none transition text-xs"
              >
                <option value="1 mes">1 mes</option>
                <option value="3 meses">3 meses</option>
                <option value="6 meses">6 meses</option>
                <option value="1 año">1 año</option>
                <option value="2 años">2 años</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1">
                <DollarSign size={14} className="text-purple-400" />
                Costo (S/.)
              </label>
              <input
                type="number"
                step="0.01"
                name="costo"
                value={formData.costo}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold focus:border-purple-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1">
                <Layers size={14} className="text-purple-400" />
                N° Sesiones
              </label>
              <input
                type="number"
                min="1"
                max="48"
                name="nSesiones"
                value={formData.nSesiones}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none transition font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Descripción u Objetivos</label>
            <textarea
              name="descripcion"
              rows="3"
              value={formData.descripcion}
              onChange={handleChange}
              placeholder="Objetivos clínicos del tratamiento, fases o notas específicas..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-purple-500 outline-none transition"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/80">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition cursor-pointer"
            >
              <Save size={18} />
              {planEditar ? 'Guardar Cambios' : 'Crear Plan'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}