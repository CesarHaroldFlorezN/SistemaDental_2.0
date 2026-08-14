import {
  CheckCircle2,
  Clipboard,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UserRoundCheck,
  UserRoundX,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../services/api';

const NOMBRES_ROL = {
  administrador: 'Administrador',
  odontologo: 'Odontólogo',
  recepcion: 'Recepción'
};

const NOMBRES_ENTORNO = {
  oficial: 'Base oficial',
  pruebas: 'Base de pruebas'
};

const formularioVacio = (entornoDatos = 'oficial') => ({
  nombre: '',
  nombreUsuario: '',
  rol: 'odontologo',
  entornoDatos,
  contrasenaTemporal: '',
  confirmacion: '',
  contrasenaAdministrador: ''
});

const generarContrasena = () => {
  const grupos = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%&*+-_'
  ];
  const alfabeto = grupos.join('');
  const numeros = new Uint32Array(36);
  window.crypto.getRandomValues(numeros);
  const obligatorios = grupos.map(
    (grupo, indice) => grupo[numeros[indice] % grupo.length]
  );
  const caracteres = [
    ...obligatorios,
    ...Array.from(
      numeros.slice(4, 18),
      (numero) => alfabeto[numero % alfabeto.length]
    )
  ];

  for (let indice = caracteres.length - 1; indice > 0; indice -= 1) {
    const destino = numeros[18 + indice] % (indice + 1);
    [caracteres[indice], caracteres[destino]] = [
      caracteres[destino],
      caracteres[indice]
    ];
  }

  return caracteres.join('');
};

function EtiquetaEntorno({ entorno }) {
  const esPruebas = entorno === 'pruebas';
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${esPruebas ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'}`}>
      <Database size={12} />
      {NOMBRES_ENTORNO[entorno] || entorno}
    </span>
  );
}

function ModalGestion({
  modal,
  formulario,
  setFormulario,
  onClose,
  onGuardar,
  guardando,
  usuarioActual
}) {
  const [mostrar, setMostrar] = useState(false);
  const esCrear = modal.tipo === 'crear';
  const esRestablecer = modal.tipo === 'restablecer';
  const puedeElegirBase =
    esCrear && usuarioActual.entornoDatos === 'oficial';
  const entornoOperacion = esCrear
    ? formulario.entornoDatos
    : modal.usuario?.entornoDatos;
  const titulo = esCrear
    ? 'Crear nuevo usuario'
    : esRestablecer
      ? `Nueva clave temporal para ${modal.usuario?.nombre}`
      : `${modal.usuario?.activo ? 'Desactivar' : 'Activar'} a ${modal.usuario?.nombre}`;

  const asignarClave = () => {
    const clave = generarContrasena();
    setFormulario((actual) => ({
      ...actual,
      contrasenaTemporal: clave,
      confirmacion: clave
    }));
    setMostrar(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={onGuardar}
        className="dp-user-modal max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">{titulo}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Esta operación requiere confirmar la contraseña del Administrador.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {esCrear && (
            <>
              <label className="block text-xs font-bold text-slate-300">
                Nombre completo
                <input
                  required
                  maxLength={120}
                  value={formulario.nombre}
                  onChange={(event) =>
                    setFormulario((actual) => ({
                      ...actual,
                      nombre: event.target.value
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                />
              </label>

              <label className="block text-xs font-bold text-slate-300">
                Usuario para iniciar sesión
                <input
                  required
                  minLength={3}
                  maxLength={40}
                  autoCapitalize="none"
                  spellCheck="false"
                  value={formulario.nombreUsuario}
                  onChange={(event) =>
                    setFormulario((actual) => ({
                      ...actual,
                      nombreUsuario: event.target.value
                        .toLowerCase()
                        .replace(/\s/g, '')
                    }))
                  }
                  placeholder="ejemplo: dra.maria"
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                />
              </label>

              <label className="block text-xs font-bold text-slate-300">
                Base de datos autorizada
                {puedeElegirBase ? (
                  <select
                    value={formulario.entornoDatos}
                    onChange={(event) =>
                      setFormulario((actual) => ({
                        ...actual,
                        entornoDatos: event.target.value
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                  >
                    <option value="oficial">
                      Base oficial · información real de la clínica
                    </option>
                    <option value="pruebas">
                      Base de pruebas · simulaciones aisladas
                    </option>
                  </select>
                ) : (
                  <div className="mt-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm font-bold text-amber-100">
                    Base de pruebas
                  </div>
                )}
              </label>

              <div className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${formulario.entornoDatos === 'pruebas' ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'}`}>
                {formulario.entornoDatos === 'pruebas'
                  ? 'Esta cuenta solo verá datos de prueba. Nunca tendrá acceso a los pacientes oficiales.'
                  : 'Esta cuenta trabajará con pacientes y operaciones reales de la clínica.'}
              </div>

              <label className="block text-xs font-bold text-slate-300">
                Perfil y jerarquía de acceso
                <select
                  value={formulario.rol}
                  onChange={(event) =>
                    setFormulario((actual) => ({
                      ...actual,
                      rol: event.target.value
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                >
                  {usuarioActual.esPropietario && (
                    <option value="administrador">
                      Administrador · gestión completa del sistema
                    </option>
                  )}
                  <option value="odontologo">
                    Odontólogo · acceso clínico, sin finanzas
                  </option>
                  <option value="recepcion">
                    Recepción · agenda y finanzas, sin clínica especializada
                  </option>
                </select>
              </label>

              {formulario.rol === 'administrador' && (
                <div className="dp-user-owner-notice rounded-xl border px-3 py-2.5 text-xs font-semibold leading-relaxed">
                  El nuevo Administrador podrá gestionar usuarios y trabajar con todos los módulos de la base asignada, pero no podrá crear ni modificar a otros administradores.
                </div>
              )}
            </>
          )}

          {!esCrear && (
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/55 px-3 py-2.5">
              <span className="text-xs font-bold text-slate-400">
                Base asignada
              </span>
              <EtiquetaEntorno entorno={entornoOperacion} />
            </div>
          )}

          {(esCrear || esRestablecer) && (
            <div className="rounded-xl border border-slate-700 bg-slate-950/55 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-300">
                  Contraseña temporal
                </span>
                <button
                  type="button"
                  onClick={asignarClave}
                  className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-cyan-500"
                >
                  <RefreshCw size={12} /> Generar segura
                </button>
              </div>

              <div className="relative">
                <input
                  required
                  minLength={12}
                  type={mostrar ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formulario.contrasenaTemporal}
                  onChange={(event) =>
                    setFormulario((actual) => ({
                      ...actual,
                      contrasenaTemporal: event.target.value
                    }))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 pr-20 text-sm text-white outline-none focus:border-cyan-400"
                />
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard?.writeText(
                        formulario.contrasenaTemporal
                      )
                    }
                    title="Copiar contraseña"
                    className="p-1 text-slate-400 hover:text-cyan-300"
                  >
                    <Clipboard size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrar((valor) => !valor)}
                    title={mostrar ? 'Ocultar' : 'Mostrar'}
                    className="p-1 text-slate-400 hover:text-cyan-300"
                  >
                    {mostrar ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <input
                required
                minLength={12}
                type={mostrar ? 'text' : 'password'}
                autoComplete="new-password"
                value={formulario.confirmacion}
                onChange={(event) =>
                  setFormulario((actual) => ({
                    ...actual,
                    confirmacion: event.target.value
                  }))
                }
                placeholder="Repite la contraseña temporal"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
              />
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                El usuario deberá cambiar esta clave obligatoriamente en su primer ingreso.
              </p>
            </div>
          )}

          {modal.tipo === 'estado' && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${modal.usuario?.activo ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'}`}>
              {modal.usuario?.activo
                ? 'La cuenta perderá el acceso inmediatamente y sus sesiones abiertas se cerrarán.'
                : 'La cuenta recuperará el acceso usando su contraseña actual.'}
            </div>
          )}

          <label className="block text-xs font-bold text-amber-200">
            Tu contraseña de Administrador
            <div className="relative mt-1.5">
              <LockKeyhole
                className="absolute left-3 top-3 text-amber-400"
                size={17}
              />
              <input
                required
                type="password"
                autoComplete="current-password"
                value={formulario.contrasenaAdministrador}
                onChange={(event) =>
                  setFormulario((actual) => ({
                    ...actual,
                    contrasenaAdministrador: event.target.value
                  }))
                }
                className="w-full rounded-xl border border-amber-500/50 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-amber-300"
              />
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            disabled={guardando}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Confirmar operación'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function UsuariosPage({ usuarioActual }) {
  const entornoPredeterminado =
    usuarioActual.entornoDatos === 'pruebas' ? 'pruebas' : 'oficial';
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [modal, setModal] = useState(null);
  const [filtroEntorno, setFiltroEntorno] = useState(
    usuarioActual.entornoDatos === 'pruebas' ? 'pruebas' : 'todos'
  );
  const [formulario, setFormulario] = useState(
    formularioVacio(entornoPredeterminado)
  );
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      setUsuarios(await api.getUsuarios());
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los usuarios.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrir = (tipo, usuario = null) => {
    setMensaje('');
    setError('');
    setFormulario(formularioVacio(entornoPredeterminado));
    setModal({ tipo, usuario });
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');
    setMensaje('');

    if (
      (modal.tipo === 'crear' || modal.tipo === 'restablecer') &&
      formulario.contrasenaTemporal !== formulario.confirmacion
    ) {
      setError('Las contraseñas temporales no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      if (modal.tipo === 'crear') {
        await api.crearUsuario({
          nombre: formulario.nombre,
          nombreUsuario: formulario.nombreUsuario,
          rol: formulario.rol,
          entornoDatos: formulario.entornoDatos,
          contrasenaTemporal: formulario.contrasenaTemporal,
          contrasenaAdministrador: formulario.contrasenaAdministrador
        });
        setMensaje(
          `Usuario creado en ${NOMBRES_ENTORNO[formulario.entornoDatos]}. Entrégale su clave temporal de manera privada.`
        );
      } else if (modal.tipo === 'restablecer') {
        await api.restablecerContrasenaUsuario(
          modal.usuario.entornoDatos,
          modal.usuario.id,
          {
            contrasenaTemporal: formulario.contrasenaTemporal,
            contrasenaAdministrador: formulario.contrasenaAdministrador
          }
        );
        setMensaje(
          'Contraseña temporal restablecida y sesiones anteriores cerradas.'
        );
      } else {
        await api.cambiarEstadoUsuario(
          modal.usuario.entornoDatos,
          modal.usuario.id,
          {
            activo: !modal.usuario.activo,
            contrasenaAdministrador: formulario.contrasenaAdministrador
          }
        );
        setMensaje(
          modal.usuario.activo
            ? 'Usuario desactivado.'
            : 'Usuario activado.'
        );
      }

      setModal(null);
      setFormulario(formularioVacio(entornoPredeterminado));
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo completar la operación.');
    } finally {
      setGuardando(false);
    }
  };

  const usuariosVisibles = usuarios.filter(
    (usuario) =>
      filtroEntorno === 'todos' || usuario.entornoDatos === filtroEntorno
  );
  const totalOficial = usuarios.filter(
    (usuario) => usuario.entornoDatos === 'oficial'
  ).length;
  const totalPruebas = usuarios.filter(
    (usuario) => usuario.entornoDatos === 'pruebas'
  ).length;

  return (
    <section className="dp-users">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {usuarioActual.esPropietario && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                <ShieldCheck size={13} /> Administrador propietario
              </span>
            )}
            {usuarioActual.entornoDatos === 'oficial' && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                <ShieldCheck size={13} /> Administra ambas bases
              </span>
            )}
            {usuarioActual.entornoDatos === 'pruebas' && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200">
                <ShieldCheck size={13} /> Solo base de pruebas
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black text-cyan-400">
            Gestión segura de usuarios
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Define la base autorizada y la jerarquía de cada cuenta. Solo el propietario puede crear o modificar otros administradores.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrir('crear')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-black text-white shadow-lg hover:bg-cyan-500"
        >
          <Plus size={17} /> Nuevo usuario
        </button>
      </div>

      {usuarioActual.entornoDatos === 'oficial' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['todos', `Todos · ${usuarios.length}`],
            ['oficial', `Base oficial · ${totalOficial}`],
            ['pruebas', `Base de pruebas · ${totalPruebas}`]
          ].map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltroEntorno(valor)}
              className={`rounded-xl border px-3 py-2 text-xs font-black transition ${filtroEntorno === valor ? 'border-cyan-400 bg-cyan-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'}`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      )}

      {mensaje && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          <CheckCircle2 size={18} /> {mensaje}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/80 shadow-xl">
        <div className="min-w-[1050px]">
          <div className="grid grid-cols-[minmax(220px,1fr)_150px_150px_110px_minmax(210px,auto)] gap-3 border-b border-slate-700 bg-slate-900/70 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-400">
            <span>Cuenta</span>
            <span>Base autorizada</span>
            <span>Perfil</span>
            <span>Estado</span>
            <span className="text-right">Acciones</span>
          </div>

          {cargando ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Cargando usuarios…
            </div>
          ) : usuariosVisibles.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No hay usuarios en esta categoría.
            </div>
          ) : (
            usuariosVisibles.map((usuario) => {
              const esAdministrador = usuario.rol === 'administrador';
              const protegida =
                usuario.esPropietario ||
                (esAdministrador && !usuarioActual.esPropietario);
              const esActual =
                Number(usuario.id) === Number(usuarioActual?.id) &&
                usuario.entornoDatos === usuarioActual?.entornoDatos;
              return (
                <div
                  key={`${usuario.entornoDatos}-${usuario.id}`}
                  className="grid grid-cols-[minmax(220px,1fr)_150px_150px_110px_minmax(210px,auto)] items-center gap-3 border-b border-slate-700/60 px-4 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UserCog
                        size={17}
                        className={
                          esAdministrador ? 'text-amber-700' : 'text-cyan-700'
                        }
                      />
                      <span className="truncate font-bold text-white">
                        {usuario.nombre}
                      </span>
                      {esActual && (
                        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">
                          TÚ
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      @{usuario.nombreUsuario}
                    </div>
                    {usuario.esPropietario && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-amber-800">
                        <ShieldCheck size={11} /> Cuenta propietaria
                      </div>
                    )}
                    {usuario.debeCambiarContrasena && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                        <KeyRound size={11} /> Cambio de contraseña pendiente
                      </div>
                    )}
                  </div>

                  <EtiquetaEntorno entorno={usuario.entornoDatos} />

                  <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-black ${esAdministrador ? 'border-amber-500/50 bg-amber-500/10 text-amber-800' : usuario.rol === 'odontologo' ? 'border-violet-500/40 bg-violet-500/10 text-violet-800' : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-800'}`}>
                    {NOMBRES_ROL[usuario.rol] || usuario.rol}
                  </span>

                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${usuario.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                    {usuario.activo ? (
                      <UserRoundCheck size={12} />
                    ) : (
                      <UserRoundX size={12} />
                    )}
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>

                  <div className="flex justify-end gap-2">
                    {protegida ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-[10px] font-bold text-amber-200">
                        <ShieldCheck size={13} /> {usuario.esPropietario ? 'Propietaria' : 'Protegida'}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => abrir('restablecer', usuario)}
                          className="rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-[10px] font-bold text-slate-100 hover:bg-cyan-700"
                        >
                          <KeyRound size={13} className="mr-1 inline" /> Nueva clave
                        </button>
                        <button
                          type="button"
                          onClick={() => abrir('estado', usuario)}
                          className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${usuario.activo ? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-600 hover:text-white' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-600 hover:text-white'}`}
                        >
                          {usuario.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="dp-user-role-card dp-user-role-admin rounded-xl border p-4 text-xs leading-relaxed">
          <strong>Administrador:</strong> todos los módulos y gestión de usuarios. Solo el propietario puede crear o modificar administradores.
        </div>
        <div className="dp-user-role-card dp-user-role-clinical rounded-xl border p-4 text-xs leading-relaxed">
          <strong>Odontólogo:</strong> pacientes, agenda, tratamientos, documentos y odontograma. No accede a finanzas.
        </div>
        <div className="dp-user-role-card dp-user-role-reception rounded-xl border p-4 text-xs leading-relaxed">
          <strong>Recepción:</strong> pacientes, agenda, cobros y planes de pago. No modifica información clínica especializada.
        </div>
        <div className="dp-user-role-card dp-user-role-transfer rounded-xl border p-4 text-xs leading-relaxed">
          <strong>Cambiar una cuenta de base:</strong> desactívala en la base actual y créala nuevamente en la base correcta. No puede estar activa en ambas.
        </div>
      </div>

      {modal && (
        <ModalGestion
          modal={modal}
          formulario={formulario}
          setFormulario={setFormulario}
          onClose={() => setModal(null)}
          onGuardar={guardar}
          guardando={guardando}
          usuarioActual={usuarioActual}
        />
      )}
    </section>
  );
}
