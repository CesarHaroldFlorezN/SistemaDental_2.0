import { useState } from 'react';
import { X, CheckCircle, FileText, DollarSign, AlertCircle } from 'lucide-react';

export default function CompletarCitaModal({ isOpen, onClose, onSave, cita, pago }) {
  const [formData, setFormData] = useState(() => ({
    procedimiento: cita?.procedimiento || '',
    costoExtra: 0,
    modoPagoExtra: 'separado', // 'separado' | 'sumar_plan'
    notasFin: cita?.notasFin || ''
  }));

  if (!isOpen || !cita) return null;

  const esSesionHija = Boolean(cita.citaBaseId);
  const costoActual = parseFloat(cita.costo || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      citaId: cita.id,
      pacienteId: cita.pacienteId,
      citaBaseId: cita.citaBaseId,
      procedimiento: formData.procedimiento,
      costoExtra: parseFloat(formData.costoExtra) || 0,
      modoPagoExtra: formData.modoPagoExtra,
      notasFin: formData.notasFin
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
            <CheckCircle size={20} />
            Completar Atención — {cita.nombrePaciente || 'Paciente'}
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
          
          {/* Procedimiento Confirmado */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Procedimientos Realizados Hoy
            </label>
            <input
              type="text"
              name="procedimiento"
              value={formData.procedimiento}
              onChange={handleChange}
              placeholder="Ej: Limpieza dental + Resina"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-emerald-500 outline-none transition font-medium"
            />
          </div>

          {/* Caja Dinámica de Costos Extras */}
          <div className="p-4 bg-slate-900/60 border border-amber-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <DollarSign size={16} />
              ¿Costo Adicional o Procedimiento Extra?
            </div>
            
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Costo extra (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="costoExtra"
                  value={formData.costoExtra}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-amber-500 outline-none text-sm font-bold"
                />
              </div>
              <div className="text-xs text-slate-400">
                Costo base: <span className="text-white font-bold">S/. {costoActual.toFixed(2)}</span>
              </div>
            </div>

            {parseFloat(formData.costoExtra) > 0 && esSesionHija && (
              <div className="pt-2 border-t border-slate-700/80 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  ¿Cómo se pagará este adicional?
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="modoPagoExtra"
                    value="separado"
                    checked={formData.modoPagoExtra === 'separado'}
                    onChange={handleChange}
                    className="accent-emerald-500"
                  />
                  <span><b>Cobrar por separado:</b> Genera cuenta independiente hoy.</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="modoPagoExtra"
                    value="sumar_plan"
                    checked={formData.modoPagoExtra === 'sumar_plan'}
                    onChange={handleChange}
                    className="accent-emerald-500"
                  />
                  <span><b>Sumar al Plan:</b> Añadir monto al saldo total de la deuda.</span>
                </label>
              </div>
            )}
          </div>

          {/* Indicaciones post-tratamiento */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <FileText size={15} className="text-emerald-400" />
              Indicaciones post-tratamiento (Notas clínicas)
            </label>
            <textarea
              name="notasFin"
              value={formData.notasFin}
              onChange={handleChange}
              rows="3"
              placeholder="Ej: Evitar alimentos duros por 24 horas, tomar ibuprofeno en caso de dolor..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-emerald-500 outline-none transition"
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
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <CheckCircle size={18} />
              Confirmar y Completar
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}