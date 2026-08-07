import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (procesando) return;

    setProcesando(true);
    setError('');

    try {
      await onLogin({
        nombreUsuario: nombreUsuario.trim(),
        contrasena
      });
    } catch (errorLogin) {
      setError(
        errorLogin.message ||
          'No se pudo iniciar sesión. Inténtalo nuevamente.'
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.2),transparent_38%)]" />

      <div className="absolute left-[-7rem] top-[-7rem] h-72 w-72 rounded-full border border-cyan-500/10 bg-cyan-500/5 blur-2xl" />
      <div className="absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full border border-blue-500/10 bg-blue-500/5 blur-2xl" />

      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/90 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl md:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden flex-col justify-between border-r border-slate-700/70 bg-gradient-to-br from-cyan-950/70 via-slate-900 to-blue-950/70 p-12 md:flex">
          <div>
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500 text-2xl font-black text-slate-950 shadow-lg shadow-cyan-500/25">
              DP
            </div>

            <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-cyan-400">
              DentalPro
            </p>

            <h1 className="max-w-md text-4xl font-black leading-tight text-white">
              Gestión clínica segura y organizada.
            </h1>

            <p className="mt-5 max-w-md leading-relaxed text-slate-300">
              Accede a pacientes, agenda, tratamientos y finanzas desde un
              entorno protegido.
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-400">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Contraseñas cifradas y sesiones protegidas
          </div>
        </div>

        <div className="p-7 sm:p-10 md:p-12">
          <div className="mb-8 md:hidden">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-xl font-black text-slate-950">
              DP
            </div>

            <p className="font-bold text-cyan-400">DentalPro</p>
          </div>

          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-400">
              Acceso seguro
            </p>

            <h2 className="text-3xl font-black text-white">
              Iniciar sesión
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Ingresa con el usuario administrativo creado para DentalPro.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={handleSubmit}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                Usuario
              </span>

              <span className="relative block">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                <input
                  type="text"
                  value={nombreUsuario}
                  onChange={(event) =>
                    setNombreUsuario(event.target.value)
                  }
                  autoComplete="username"
                  required
                  autoFocus
                  placeholder="cesar.admin"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3.5 pl-12 pr-4 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">
                Contraseña
              </span>

              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

                <input
                  type={mostrarContrasena ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(event) =>
                    setContrasena(event.target.value)
                  }
                  autoComplete="current-password"
                  required
                  placeholder="Ingresa tu contraseña"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3.5 pl-12 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setMostrarContrasena((valorActual) => !valorActual)
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-cyan-400"
                  aria-label={
                    mostrarContrasena
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  {mostrarContrasena ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={procesando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3.5 font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {procesando && (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              )}

              {procesando ? 'Verificando…' : 'Ingresar a DentalPro'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
            El acceso queda limitado a usuarios autorizados.
          </p>
        </div>
      </section>
    </main>
  );
}