import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeDollarSign, RotateCcw, WalletCards, X, XCircle } from 'lucide-react';

const moneda = (valor) => `S/. ${Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CancelarCitaModalV8({ isOpen, onClose, onSave, cita, pago }) {
  const [motivo, setMotivo] = useState('');
  const [opcion, setOpcion] = useState('retener');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMotivo('');
    setOpcion(Number(pago?.cobrado || 0) > 0 ? 'retener' : 'sin_pago');
    setError('');
    setGuardando(false);
  }, [isOpen, cita?.id, pago?.id]);

  if (!isOpen || !cita) return null;
  const cobrado = Math.max(0, Number(pago?.cobrado || 0));

  const enviar = async (event) => {
    event.preventDefault();
    if (!motivo.trim()) return setError('El motivo de la cancelacion es obligatorio.');
    try {
      setGuardando(true);
      await onSave({
        citaId: cita.id,
        pagoId: pago?.id || null,
        motivoCancelacion: motivo.trim(),
        opcionDevolucion: cobrado > 0 ? opcion : 'sin_pago',
        montoCobrado: cobrado
      });
    } finally {
      setGuardando(false);
    }
  };

  const opciones = [
    ['total_dev', 'Devolver el dinero', 'Registra una devolucion auditable y deja la cita sin deuda.', RotateCcw, 'rose'],
    ['credito', 'Dejar como credito a favor', 'El dinero queda disponible para una futura atencion.', WalletCards, 'cyan'],
    ['retener', 'Retener como cargo de cancelacion', 'Conserva lo cobrado y cierra la cuenta de esta cita.', BadgeDollarSign, 'amber']
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-rose-500/25 bg-slate-800 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-700 px-6 py-5">
          <div><h2 className="flex items-center gap-2 text-xl font-black text-rose-400"><XCircle size={21} />Cancelar cita</h2><p className="mt-1 font-bold text-white">{cita.nombrePaciente || 'Paciente'}</p><p className="mt-1 text-xs text-slate-500">La cita cambia a Cancelada; el movimiento financiero queda registrado por separado.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={19} /></button>
        </header>

        <form onSubmit={enviar} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
          <section className="rounded-xl border border-slate-700 bg-slate-900/65 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-400">Tratamiento</span><b className="text-right text-white">{cita.procedimiento || 'Atencion dental'}</b></div><div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">Fecha y hora</span><b className="text-cyan-300">{cita.fecha} · {cita.hora}</b></div>{cobrado > 0 && <div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">Dinero recibido</span><b className="text-emerald-300">{moneda(cobrado)}</b></div>}</section>

          {cobrado > 0 && <section><div className="mb-3 flex items-center gap-2 text-sm font-black text-amber-300"><AlertTriangle size={17} />¿Que se hara con el dinero recibido?</div><div className="grid gap-2">{opciones.map(([valor, titulo, descripcion, Icono, tono]) => <button key={valor} type="button" onClick={() => setOpcion(valor)} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${opcion === valor ? tono === 'rose' ? 'border-rose-500 bg-rose-500/10' : tono === 'cyan' ? 'border-cyan-500 bg-cyan-500/10' : 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-900/55'}`}><Icono size={19} className="mt-0.5 shrink-0 text-slate-300" /><span><span className="block font-bold text-white">{titulo}</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{descripcion}</span></span></button>)}</div></section>}

          <label className="block text-sm font-semibold text-slate-300">Motivo de cancelacion *<textarea value={motivo} onChange={(e) => { setMotivo(e.target.value); setError(''); }} rows="3" placeholder="Ej.: El paciente solicito reprogramar por viaje..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-white outline-none focus:border-rose-500" /></label>

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4"><button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-bold text-slate-200">Volver</button><button type="submit" disabled={guardando} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><XCircle size={17} />{guardando ? 'Procesando...' : 'Confirmar cancelacion'}</button></div>
        </form>
      </div>
    </div>
  );
}
