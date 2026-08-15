import { useState } from 'react';
import {
  LogOut,
  UserRound,
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  DollarSign,
  FolderKanban,
  ListTree,
  LayoutDashboard,
  UserCog,
  Users
} from 'lucide-react';

const ROLES_TODOS = [
  'administrador',
  'odontologo',
  'recepcion'
];

const NOMBRES_ROL = {
  administrador: 'Administrador',
  odontologo: 'Odontólogo',
  recepcion: 'Recepción'
};

export default function Sidebar({
  vistaActiva,
  setVistaActiva,
  usuarioActual,
  onCerrarSesion
}) {
  const [contraido, setContraido] = useState(() => localStorage.getItem('dp-sidebar-contraido') === '1');
  const nombreRolActual = usuarioActual?.esPropietario
    ? 'Administrador propietario'
    : NOMBRES_ROL[usuarioActual?.rol] || usuarioActual?.rol;

  const menuItems = [
    {
      id: 'dashboard',
      nombre: 'Dashboard',
      icono: LayoutDashboard,
      roles: ROLES_TODOS
    },
    {
      id: 'pacientes',
      nombre: 'Pacientes',
      icono: Users,
      roles: ROLES_TODOS
    },
    {
      id: 'citas',
      nombre: 'Agenda / Citas',
      icono: Calendar,
      roles: ROLES_TODOS
    },
    {
      id: 'planes',
      nombre: 'Planes Tratamiento',
      icono: FolderKanban,
      roles: [
        'administrador',
        'odontologo'
      ]
    },
    {
      id: 'finanzas',
      nombre: 'Finanzas',
      icono: DollarSign,
      roles: [
        'administrador',
        'recepcion'
      ]
    },
    {
      id: 'planpagos',
      nombre: 'Planes de Pago',
      icono: CreditCard,
      roles: [
        'administrador',
        'recepcion'
      ]
    },
    {
      id: 'catalogo',
      nombre: 'Tratamientos y precios',
      icono: ListTree,
      roles: ['administrador']
    },
    {
      id: 'usuarios',
      nombre: 'Usuarios',
      icono: UserCog,
      roles: ['administrador']
    }
  ].filter((item) =>
    item.roles.includes(usuarioActual?.rol)
  );

  const alternar = () => {
    setContraido((actual) => {
      const siguiente = !actual;
      localStorage.setItem('dp-sidebar-contraido', siguiente ? '1' : '0');
      return siguiente;
    });
  };

  return (
    <aside className={`dp-sidebar ${contraido ? 'w-[76px]' : 'w-64'} sticky top-0 z-40 flex h-screen shrink-0 select-none flex-col justify-between border-r border-slate-700/80 bg-slate-800/95 p-3 shadow-xl transition-[width] duration-300`}>
      <div className="min-w-0">
        <div className={`relative mb-5 flex items-center border-b border-slate-700/80 py-4 ${contraido ? 'justify-center px-1' : 'gap-3 px-2'}`}>
          <div className="shrink-0 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-400">
            <Activity size={23} />
          </div>

          {!contraido && (
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold leading-tight text-white">DentalPro</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Sistema clínico</span>
            </div>
          )}

          <button
            type="button"
            onClick={alternar}
            title={contraido ? 'Desplegar menú' : 'Ocultar menú'}
            className={`absolute flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-400 shadow-lg transition hover:border-cyan-500 hover:text-cyan-300 ${contraido ? '-right-6 top-5' : '-right-6 top-5'}`}
          >
            {contraido ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icono = item.icono;
            const activo = vistaActiva === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setVistaActiva(item.id)}
                title={contraido ? item.nombre : undefined}
                className={`group flex w-full items-center rounded-xl py-3 text-sm font-semibold transition duration-200 ${contraido ? 'justify-center px-2' : 'gap-3 px-3.5'} ${
                  activo
                    ? 'dp-sidebar-active bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <Icono size={19} className="shrink-0" />
                {!contraido && <span className="truncate">{item.nombre}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-700/80 pt-4">
        <div
          className={`mb-3 flex items-center ${
            contraido ? 'justify-center' : 'gap-3 px-2'
          }`}
          title={
            contraido
              ? `${usuarioActual?.nombre} · ${nombreRolActual}`
              : undefined
          }
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <UserRound size={18} />
          </div>

          {!contraido && (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-200">
                {usuarioActual?.nombre}
              </p>

              <p className="truncate text-[10px] capitalize text-cyan-400">
                {nombreRolActual}
              </p>

              <p className={`mt-1 flex items-center gap-1 truncate text-[9px] font-black uppercase tracking-wide ${usuarioActual?.entornoDatos === 'pruebas' ? 'text-amber-300' : 'text-emerald-300'}`}>
                <Database size={10} />
                {usuarioActual?.entornoDatos === 'pruebas' ? 'Base de pruebas' : 'Base oficial'}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onCerrarSesion}
          title="Cerrar sesión"
          className={`mb-4 flex w-full items-center rounded-xl py-2.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 ${
            contraido
              ? 'justify-center px-2'
              : 'gap-3 px-3.5'
          }`}
        >
          <LogOut size={17} />

          {!contraido && (
            <span>Cerrar sesión</span>
          )}
        </button>

        <div
          className={`flex items-center py-1 text-xs text-slate-500 ${
            contraido
              ? 'justify-center px-1'
              : 'justify-between px-2'
          }`}
        >
          {!contraido && <span>Versión 2.0</span>}

          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_9px_rgba(16,185,129,.6)]"
            title="Backend conectado"
          />
        </div>
      </div>
    </aside>
  );
}
