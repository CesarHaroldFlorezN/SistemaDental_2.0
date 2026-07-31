import { useState } from 'react';
import { X, Save, Calendar, Clock, User, FileText, Stethoscope, DollarSign, Layers } from 'lucide-react';

export default function CitaModal({ isOpen, onClose, onSave, citaEditar, pacientes = [] }) {
  const [formData, setFormData] = useState(() => ({
    pacienteId: citaEditar?.pacienteId || (pacientes[0]?.id || ''),
    fecha: citaEditar?.fecha || new Date().toISOString().split('T')[0],
    hora: citaEditar?.hora || '09:00',
    procedimiento: citaEditar?.procedimiento || 'Consulta de evaluación',
    costo: citaEditar?.costo || 0,
    tipoPago: citaEditar?.tipoPago || 'contado',
    estado: citaEditar?.estado || 'pendiente',
    sesionNum: citaEditar?.sesionNum || 1,
    totalSesiones: citaEditar?.totalSesiones || 1,
    notas: citaEditar?.notas || '',
    doctor: 'Dr. Flórez' // Por defecto
  }));

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.pacienteId) return;
    
    // Preparamos el payload exacto que espera CitaDB en FastAPI (main.py)
    const payload = {
      pacienteId: parseInt(formData.pacienteId, 10),
      fecha: formData.fecha,
      hora: formData.hora,
      procedimiento: formData.procedimiento,
      costo: parseFloat(formData.costo) || 0,
      tipoPago: formData.tipoPago,
      estado: formData.estado,
      sesionNum: parseInt(formData.sesionNum, 10) || 1,
      totalSesiones: parseInt(formData.totalSesiones, 10) || 1,
      notas: formData.notas,
      creadaEn: new Date().toISOString()
    };

    onSave(payload, citaEditar?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <Calendar size={20} />
            {citaEditar ? 'Editar Cita Clínica' : 'Agendar Nueva Cita'}
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
          
          {/* Selección de Paciente */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <User size={15} className="text-cyan-400" />
              Paciente <span className="text-red-400">*</span>
            </label>
            <select
              name="pacienteId"
              required
              value={formData.pacienteId}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition font-medium"
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
            {/* Fecha */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar size={15} className="text-cyan-400" />
                Fecha
              </label>
              <input
                type="date"
                name="fecha"
                value={formData.fecha}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            {/* Hora */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Clock size={15} className="text-cyan-400" />
                Hora
              </label>
              <input
                type="time"
                name="hora"
                value={formData.hora}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition font-semibold text-cyan-400"
              />
            </div>
          </div>

          {/* Procedimiento */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <FileText size={15} className="text-cyan-400" />
              Procedimiento / Tratamiento
            </label>
            <select
              name="procedimiento"
              value={formData.procedimiento}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
            >
              <option value="Consulta de evaluación">Consulta de evaluación</option>
              <option value="Limpieza dental">Limpieza dental</option>
              <option value="Empaste / Resina">Empaste / Resina</option>
              <option value="Endodoncia (canal)">Endodoncia (canal)</option>
              <option value="Extracción simple">Extracción simple</option>
              <option value="Extracción muela juicio">Extracción muela juicio</option>
              <option value="Corona dental">Corona dental</option>
              <option value="Implante dental">Implante dental</option>
              <option value="Blanqueamiento">Blanqueamiento</option>
              <option value="Ortodoncia — colocación">Ortodoncia — colocación</option>
              <option value="Ortodoncia — control">Ortodoncia — control</option>
              <option value="Prótesis dental">Prótesis dental</option>
              <option value="Rayos X">Rayos X</option>
              <option value="Cirugía oral">Cirugía oral</option>
              <option value="Otro">Otro procedimiento</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Costo */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <DollarSign size={15} className="text-cyan-400" />
                Costo (S/.)
              </label>
              <input
                type="number"
                step="0.01"
                name="costo"
                value={formData.costo}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            {/* Tipo de Pago */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Modalidad de Pago
              </label>
              <select
                name="tipoPago"
                value={formData.tipoPago}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              >
                <option value="contado">Al finalizar (Contado)</option>
                <option value="completo">Pagado completo hoy</option>
                <option value="anticipo">Con Anticipo</option>
                <option value="cuotas">En Cuotas</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Estado */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Estado de la Cita
              </label>
              <select
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              >
                <option value="pendiente">Pendiente / Por Atender</option>
                <option value="en_atencion">En Atención 🔴</option>
                <option value="completada">Completada / Atendida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            {/* Total Sesiones */}
            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Layers size={15} className="text-cyan-400" />
                Sesiones en Total
              </label>
              <input
                type="number"
                min="1"
                name="totalSesiones"
                value={formData.totalSesiones}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Notas o Indicaciones
            </label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleChange}
              rows="2"
              placeholder="Síntomas, alergias del paciente, indicaciones médicas..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
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
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
            >
              <Save size={18} />
              {citaEditar ? 'Actualizar Cita' : 'Agendar Cita'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}