import { useState, useEffect } from 'react';
import { 
  X, Save, User, FileText, CreditCard, 
  Phone, Mail, Calendar, MapPin, 
  AlertTriangle, Pill 
} from 'lucide-react';

export default function PacienteModal({ isOpen, onClose, onSave, pacienteEditar }) {
  const [formData, setFormData] = useState({
    codigo_ficha: '',
    cedula: '',
    nombre: '',
    telefono: '',
    correo: '',
    fechaNacimiento: '',
    genero: '',
    direccion: '',
    alergias: '',
    medicamentos: ''
  });

  // Cargar datos si estamos editando, o limpiar si es nuevo paciente
  useEffect(() => {
    if (pacienteEditar) {
      setFormData({
        codigo_ficha: pacienteEditar.codigo_ficha || '',
        cedula: pacienteEditar.cedula || '',
        nombre: pacienteEditar.nombre || '',
        telefono: pacienteEditar.telefono || '',
        correo: pacienteEditar.correo || pacienteEditar.email || '',
        fechaNacimiento: pacienteEditar.fechaNacimiento || pacienteEditar.fecha_nacimiento || '',
        genero: pacienteEditar.genero || '',
        direccion: pacienteEditar.direccion || '',
        alergias: pacienteEditar.alergias || '',
        medicamentos: pacienteEditar.medicamentos || ''
      });
    } else {
      setFormData({
        codigo_ficha: '',
        cedula: '',
        nombre: '',
        telefono: '',
        correo: '',
        fechaNacimiento: '',
        genero: '',
        direccion: '',
        alergias: '',
        medicamentos: ''
      });
    }
  }, [pacienteEditar, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Exigimos obligatoriamente Nombre y DNI
    if (!formData.nombre.trim() || !formData.cedula.trim()) return;
    onSave(formData, pacienteEditar?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/90">
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <User size={22} className="text-cyan-400" />
            {pacienteEditar ? 'Editar Ficha del Paciente' : 'Nuevo Paciente'}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          
          {/* FILA 1: ID Ficha + DNI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                <FileText size={15} className="text-cyan-400" />
                ID de Ficha / N° Ficha
              </label>
              <input
                type="text"
                name="codigo_ficha"
                value={formData.codigo_ficha}
                onChange={handleChange}
                placeholder="Ej: F-001 o 1630"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                <CreditCard size={15} className="text-cyan-400" />
                DNI / Cédula <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="cedula"
                required
                value={formData.cedula}
                onChange={handleChange}
                placeholder="Ej: 72509217"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition font-medium"
              />
            </div>
          </div>

          {/* FILA 2: Nombre Completo */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Nombre Completo <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              required
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: MARÍA GONZÁLEZ o CARLOS BROCK"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold focus:border-cyan-500 outline-none transition"
            />
          </div>

          {/* FILA 3: Teléfono + Fecha de Nacimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                <Phone size={15} className="text-cyan-400" />
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="Ej: 999 888 777"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                <Calendar size={15} className="text-cyan-400" />
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                name="fechaNacimiento"
                value={formData.fechaNacimiento}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition text-xs"
              />
            </div>
          </div>

          {/* FILA 4: Género + Correo Electrónico */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Género
              </label>
              <select
                name="genero"
                value={formData.genero}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              >
                <option value="">— Seleccionar —</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                <Mail size={15} className="text-cyan-400" />
                Correo Electrónico
              </label>
              <input
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                placeholder="ejemplo@correo.com"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>
          </div>

          {/* FILA 5: Dirección */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
              <MapPin size={15} className="text-cyan-400" />
              Dirección
            </label>
            <input
              type="text"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Ej: Av. Principal 123"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
            />
          </div>

          {/* FILA 6: ALERGIAS / ANTECEDENTES (Con resaltado de advertencia) */}
          <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-1.5">
            <label className="block text-rose-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-rose-400" />
              ⚠️ Alergias / Antecedentes Médicos
            </label>
            <textarea
              name="alergias"
              rows="2"
              value={formData.alergias}
              onChange={handleChange}
              placeholder="Ej: Alérgico a penicilina, hipertenso, asma, problemas cardíacos..."
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-rose-500 outline-none transition text-xs"
            />
          </div>

          {/* FILA 7: MEDICAMENTOS ACTUALES */}
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5">
            <label className="block text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Pill size={16} className="text-amber-400" />
              💊 Medicamentos Actuales
            </label>
            <textarea
              name="medicamentos"
              rows="2"
              value={formData.medicamentos}
              onChange={handleChange}
              placeholder="Ej: Metformina 500mg, Losartán, anticoagulantes..."
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-amber-500 outline-none transition text-xs"
            />
          </div>

          {/* Botones de Pie */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
            >
              <Save size={18} />
              {pacienteEditar ? 'Guardar Cambios' : 'Registrar Paciente'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}