import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { api } from '../../../services/api';

export default function CambiarContrasenaObligatoria({
  usuario,
  onContrasenaCambiada
}) {
  const [formulario, setFormulario] = useState({
    actual: '',
    nueva: '',
    confirmacion: ''
  });
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');

    if (formulario.nueva.length < 12) {
      setError('La nueva contraseña debe tener al menos 12 caracteres.');
      return;
    }

    if (formulario.nueva !== formulario.confirmacion) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      await api.cambiarContrasena({
        contrasenaActual: formulario.actual,
        nuevaContrasena: formulario.nueva
      });
      onContrasenaCambiada?.();
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100">
      <section className="w-full max-w-lg rounded-3xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl shadow-cyan-950/30 sm:p-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-3 text-cyan-300">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Crea tu contraseña privada</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              Hola, {usuario?.nombre}. La clave entregada por el Administrador es temporal y debe reemplazarse antes de entrar al sistema.
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={enviar}>
          {[
            ['actual', 'Contraseña temporal'],
            ['nueva', 'Nueva contraseña'],
            ['confirmacion', 'Repite la nueva contraseña']
          ].map(([campo, etiqueta]) => (
            <label key={campo} className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-300">{etiqueta}</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={formulario[campo]}
                  onChange={(event) => setFormulario((actual) => ({ ...actual, [campo]: event.target.value }))}
                  autoComplete={campo === 'actual' ? 'current-password' : 'new-password'}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-11 text-sm text-white outline-none transition focus:border-cyan-400"
                />
                <button type="button" onClick={() => setMostrar((valor) => !valor)} className="absolute right-3 top-2.5 text-slate-500 hover:text-cyan-300" aria-label={mostrar ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}>
                  {mostrar ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
          ))}

          <p className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs leading-relaxed text-slate-400">
            Utiliza al menos 12 caracteres. Combina mayúsculas, minúsculas, números y símbolos. No compartas esta contraseña.
          </p>

          {error && <div role="alert" className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200">{error}</div>}

          <button disabled={guardando} className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60">
            {guardando ? 'Protegiendo cuenta…' : 'Guardar y volver a iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  );
}
