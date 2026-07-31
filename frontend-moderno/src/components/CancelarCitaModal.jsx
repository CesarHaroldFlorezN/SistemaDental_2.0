import { useState } from 'react';
import { X, XCircle, AlertTriangle, DollarSign } from 'lucide-react';

export default function CancelarCitaModal({ isOpen, onClose, onSave, cita, pago }) {
  const [formData, setFormData] = useState(() => ({
    motivoCancelacion: '',
    opcionDevolucion: 'retener' // 'total_dev' | 'credito' | 'retener'
  }));

  if (!isOpen || !cita) return null;

  const cobrado = parseFloat(pago?.cobrado || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      citaId: cita.id,
      pagoId: pago?.id || null,
      motivoCancelacion: formData.motivoCancelacion,
      opcionDevolucion: formData.opcionDevolucion,
      montoCobrado: cobrado
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-xl font-bold text-rose-400 flex items-center gap-2">
            <XCircle size={20} />
            Cancelar Cita — {cita.nombrePaciente || 'Paciente'}
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
          
          {/* Información Clínica Rápida */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-700 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Tratamiento:</span>
              <span className="text-white font-medium">{cita.procedimiento || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fecha y hora:</span>
              <span className="text-cyan-400 font-medium">{cita.fecha} — {cita.hora}</span>
            </div>
          </div>

          {/* Opciones de Devolución (Si hubo anticipo pagado) */}
          {cobrado > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                <AlertTriangle size={15} />
                Se pagó un anticipo de S/. {cobrado.toFixed(2)}. ¿Qué deseas hacer?
              </div>
              
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-700 bg-slate-900/60 cursor-pointer hover:border-amber-500/50 transition">
                  <input
                    type="radio"
                    name="opcionDevolucion"
                    value="total_dev"
                    checked={formData.opcionDevolucion === 'total_dev'}
                    onChange={handleChange}
                    className="accent-amber-500"
                  />
                  <span className="text-xs text-slate-200">
                    <b>Devolver todo (S/. {cobrado.toFixed(2)}):</b> Retirar cobro y saldo.
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-700 bg-slate-900/60 cursor-pointer hover:border-amber-500/50 transition">
                  <input
                    type="radio"
                    name="opcionDevolucion"
                    value="credito"
                    checked={formData.opcionDevolucion === 'credito'}
                    onChange={handleChange}
                    className="accent-amber-500"
                  />
                  <span className="text-xs text-slate-200">
                    <b>Crédito a favor:</b> Dejar saldo disponible para futuras citas.
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-700 bg-slate-900/60 cursor-pointer hover:border-amber-500/50 transition">
                  <input
                    type="radio"
                    name="opcionDevolucion"
                    value="retener"
                    checked={formData.opcionDevolucion === 'retener'}
                    onChange={handleChange}
                    className="accent-amber-500"
                  />
                  <span className="text-xs text-slate-200">
                    <b>Retener (Cargo por cancelación):</b> No reembolsar el dinero.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Motivo de Cancelación */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Motivo de Cancelación
            </label>
            <textarea
              name="motivoCancelacion"
              value={formData.motivoCancelacion}
              onChange={handleChange}
              rows="3"
              placeholder="Ej: El paciente reagendó para el próximo mes, viaje imprevisto..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-rose-500 outline-none transition"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/80">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition cursor-pointer"
            >
              Volver
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition cursor-pointer"
            >
              <XCircle size={18} />
              Confirmar Cancelación
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}