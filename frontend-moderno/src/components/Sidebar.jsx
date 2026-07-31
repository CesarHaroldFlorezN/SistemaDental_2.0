import { Users, Calendar, DollarSign, Activity, LayoutDashboard, CreditCard, FolderKanban } from 'lucide-react';

export default function Sidebar({ vistaActiva, setVistaActiva }) {
  const menuItems = [
    { id: 'dashboard', nombre: 'Dashboard', icono: LayoutDashboard },
    { id: 'pacientes', nombre: 'Pacientes', icono: Users },
    { id: 'citas', nombre: 'Agenda / Citas', icono: Calendar },
    { id: 'planes', nombre: 'Planes Tratamiento', icono: FolderKanban },
    { id: 'finanzas', nombre: 'Finanzas', icono: DollarSign },
    { id: 'planpagos', nombre: 'Planes de Pago', icono: CreditCard },
  ];

  return (
    <aside className="w-64 bg-slate-800/90 border-r border-slate-700/80 flex flex-col justify-between min-h-screen p-4 select-none shrink-0">
      <div>
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-700/80">
          <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-cyan-400">
            <Activity size={24} />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white leading-tight">DentalPro</h2>
            <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">Sistema Clínico</span>
          </div>
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icono = item.icono;
            const activo = vistaActiva === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setVistaActiva(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition duration-200 cursor-pointer ${
                  activo
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
              >
                <Icono size={19} className={activo ? 'text-white' : 'text-slate-400'} />
                {item.nombre}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-3 py-4 border-t border-slate-700/80 text-xs text-slate-500 flex justify-between items-center">
        <span>Versión 2.0 (React)</span>
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Backend Conectado"></span>
      </div>
    </aside>
  );
}