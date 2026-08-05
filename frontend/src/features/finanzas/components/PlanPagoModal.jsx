import { useState, useEffect } from 'react';
import { X, Save, User, CreditCard } from 'lucide-react';

export default function PlanPagoModal({ isOpen, onClose, onSave, pacientes = [] }) {
  const hoyStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState(() => ({
    pacienteId: pacientes[0]?.id || '',
    concepto: 'Ortodoncia / Tratamiento en Cuotas',
    totalAcordado: '',
    anticipo: 0,
    nCuotas: 3,
    intervalo: 30, // 30 = Mensual, 15 = Quincenal, 7 = Semanal
    fechaPrimeraCuota: hoyStr,
    metodoPreferido: 'Efectivo'
  }));

  const [cuotasPreview, setCuotasPreview] = useState([]);

  // Ayudante para sumar días a una fecha
  const addDays = (fechaStr, dias) => {
    const dt = new Date(`${fechaStr}T12:00:00`);
    dt.setDate(dt.getDate() + dias);
    return dt.toISOString().split('T')[0];
  };

  // Generar cronograma preliminar en tiempo real
  useEffect(() => {
    const total = parseFloat(formData.totalAcordado) || 0;
    const anticipo = parseFloat(formData.anticipo) || 0;
    const num = parseInt(formData.nCuotas, 10) || 1;
    const intervalo = parseInt(formData.intervalo, 10) || 30;
    const restante = Math.max(0, total - anticipo);
    const montoCuota = (restante / num).toFixed(2);

    const lista = [];
    if (anticipo > 0) {
      lista.push({
        num: 0,
        tipo: 'anticipo',
        fecha: hoyStr,
        monto: anticipo,
        pagado: false,
        fechaPago: null,
        metodoPago: null
      });
    }

    for (let i = 0; i < num; i++) {
      const fechaVenc = i === 0 ? formData.fechaPrimeraCuota : addDays(formData.fechaPrimeraCuota, i * intervalo);
      lista.push({
        num: i + 1,
        tipo: 'cuota',
        fecha: fechaVenc,
        monto: parseFloat(montoCuota),
        pagado: false,
        fechaPago: null,
        metodoPago: null
      });
    }
    setCuotasPreview(lista);
}, [formData, hoyStr]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.pacienteId || !formData.totalAcordado) return;

    const totalCuotas = cuotasPreview.reduce((acc, q) => acc + q.monto, 0);

    const payload = {
      pacienteId: parseInt(formData.pacienteId, 10),
      pagoId: 0,
      citaId: 0,
      concepto: formData.concepto,
      totalAcordado: parseFloat(formData.totalAcordado) || 0,
      anticipo: parseFloat(formData.anticipo) || 0,
      metodoPreferido: formData.metodoPreferido,
      estado: 'activo',
      cuotas: cuotasPreview,
      totalCuotas: totalCuotas,
      cobrado: 0,
      saldo: totalCuotas,
      fechaCreacion: hoyStr,
      creadoEn: new Date().toISOString()
    };

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/80">
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <CreditCard size={20} />
            Crear Plan de Pago en Cuotas
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Concepto / Tratamiento</label>
              <input
                type="text"
                name="concepto"
                value={formData.concepto}
                onChange={handleChange}
                placeholder="Ej: Ortodoncia completa"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Monto Total a Financiar (S/.) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                name="totalAcordado"
                required
                value={formData.totalAcordado}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-cyan-400 focus:border-cyan-500 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Anticipo / Enganche (S/.)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="anticipo"
                value={formData.anticipo}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Número de Cuotas</label>
              <input
                type="number"
                min="1"
                max="36"
                name="nCuotas"
                value={formData.nCuotas}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Intervalo</label>
              <select
                name="intervalo"
                value={formData.intervalo}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              >
                <option value={7}>Semanal (7 días)</option>
                <option value={15}>Quincenal (15 días)</option>
                <option value={30}>Mensual (30 días)</option>
                <option value={60}>Bimestral (60 días)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Primera Cuota</label>
              <input
                type="date"
                name="fechaPrimeraCuota"
                value={formData.fechaPrimeraCuota}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition text-xs"
              />
            </div>
          </div>

          {/* TABLA PRELIMINAR DE CUOTAS */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Cronograma Generado ({cuotasPreview.length} pagos):
            </div>
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 uppercase">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Fecha Vencimiento</th>
                    <th className="p-2.5 text-right">Monto (S/.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {cuotasPreview.map((q, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-cyan-400">{q.tipo === 'anticipo' ? '0' : q.num}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${q.tipo === 'anticipo' ? 'bg-amber-500/15 text-amber-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                          {q.tipo === 'anticipo' ? 'Anticipo' : 'Cuota'}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-300">{q.fecha}</td>
                      <td className="p-2.5 text-right font-serif font-bold text-white">S/. {q.monto.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              Confirmar y Crear Plan
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}