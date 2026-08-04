import { X, FileText, AlertTriangle, Pill, Calendar, DollarSign, CheckCircle, Clock } from 'lucide-react';

export default function FichaPacienteModal({ isOpen, onClose, paciente, citas = [], pagos = [], onNuevaCita, onEditarPaciente }) {
  if (!isOpen || !paciente) return null;

  // Filtrar citas del paciente ordenadas por fecha reciente
  const citasPaciente = citas
    .filter(c => c.pacienteId === paciente.id)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  // Cálculos financieros del paciente
  const pagosPaciente = pagos.filter(g => g.pacienteId === paciente.id);
  const totalPagado = pagosPaciente.reduce((acc, g) => acc + parseFloat(g.cobrado || 0), 0);
  const saldoPendiente = pagosPaciente.reduce((acc, g) => acc + parseFloat(g.saldo || 0), 0);

  const fMon = (num) => `S/. ${parseFloat(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getBadgeEstado = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'completada':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold">Completada</span>;
      case 'en_atencion':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-xs font-semibold">En Atención</span>;
      case 'cancelada':
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded text-xs font-semibold">Cancelada</span>;
      default:
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold">Pendiente</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
              {(paciente.nombre || '?').charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {paciente.nombre}
              </h2>
              <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                Ficha N°: {paciente.codigo_ficha || 'Sin Ficha'} | DNI: {paciente.cedula || '—'}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          
          {/* 1. ALERTAS MÉDICAS (Solo se muestran si hay datos) */}
          {(paciente.alergias || paciente.medicamentos) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paciente.alergias && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-400 text-xs uppercase tracking-wider">Alergias / Antecedentes</div>
                    <div className="text-slate-200 text-xs mt-1">{paciente.alergias}</div>
                  </div>
                </div>
              )}
              {paciente.medicamentos && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-2.5">
                  <Pill size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-400 text-xs uppercase tracking-wider">Medicamentos Actuales</div>
                    <div className="text-slate-200 text-xs mt-1">{paciente.medicamentos}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. DATOS PERSONALES Y RESUMEN ECONÓMICO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Contacto */}
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-1.5 text-xs">
              <div className="font-bold text-slate-400 uppercase tracking-wider mb-2">Datos de Contacto</div>
              <div><span className="text-slate-400">Teléfono:</span> <strong className="text-white">{paciente.telefono || '—'}</strong></div>
              <div><span className="text-slate-400">Dirección:</span> <strong className="text-white">{paciente.direccion || '—'}</strong></div>
              <div><span className="text-slate-400">Género:</span> <strong className="text-white">{paciente.genero || '—'}</strong></div>
            </div>

            {/* Citas Totales */}
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="font-bold text-slate-400 text-xs uppercase tracking-wider">Total de Citas</div>
              <div className="text-3xl font-serif font-bold text-cyan-400 mt-2">{citasPaciente.length}</div>
              <div className="text-xs text-slate-500 mt-1">Registradas en historial</div>
            </div>

            {/* Estado de Cuenta */}
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="font-bold text-slate-400 text-xs uppercase tracking-wider">Estado de Cuenta</div>
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Pagado:</span>
                  <span className="text-emerald-400 font-semibold">{fMon(totalPagado)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Saldo pendiente:</span>
                  <span className={`font-bold ${saldoPendiente > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {saldoPendiente > 0 ? fMon(saldoPendiente) : '✓ Al día'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. HISTORIAL DE CITAS Y CONSULTAS */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Calendar size={15} className="text-cyan-400" />
              Historial de Citas y Tratamientos
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {citasPaciente.length > 0 ? (
                citasPaciente.map(c => (
                  <div key={c.id} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3.5 flex justify-between items-start hover:border-slate-600 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{c.procedimiento || 'Consulta General'}</span>
                        {c.totalSesiones > 1 && (
                          <span className="text-xs text-purple-400 font-medium">
                            (Sesión {c.sesionNum || 1}/{c.totalSesiones})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>📅 {c.fecha || '—'} a las {c.hora || '—'}</span>
                      </div>
                      {c.notasFin && (
                        <div className="text-xs text-cyan-300/80 bg-cyan-500/5 px-2.5 py-1 rounded-lg border border-cyan-500/10 mt-1">
                          📝 {c.notasFin}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {getBadgeEstado(c.estado)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs bg-slate-900/30 rounded-xl">
                  Este paciente aún no tiene citas en su historial.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Pie de botones de acción rápida */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-700 bg-slate-800/80">
          <button
            type="button"
            onClick={() => { onClose(); onEditarPaciente(paciente); }}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            ✏️ Editar Datos del Paciente
          </button>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => { onClose(); onNuevaCita(paciente); }}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
            >
              📅 Agendar Nueva Cita
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}