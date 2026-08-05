import {
  Download,
  Edit,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';

export default function PacientesPage({
  pacientes,
  busqueda,
  onCambiarBusqueda,
  onExportar,
  onImportar,
  onNuevo,
  onVerFicha,
  onEditar,
  onEliminar,
}) {
  return (
    <div>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            Gestión de Pacientes
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Directorio clínico y expedientes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-semibold text-cyan-400 lg:inline-block">
            {pacientes.length} Registros
          </span>

          <button
            type="button"
            onClick={onExportar}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-slate-600"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-slate-600">
            <Upload size={18} />
            <span className="hidden sm:inline">Importar CSV</span>

            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onImportar}
            />
          </label>

          <button
            type="button"
            onClick={onNuevo}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500"
          >
            <UserPlus size={18} />
            Nuevo Paciente
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-3.5 text-slate-400"
          size={18}
        />

        <input
          type="text"
          placeholder="Buscar por ficha, nombre, DNI, teléfono o correo..."
          value={busqueda}
          onChange={(event) => onCambiarBusqueda(event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-500"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-800/80 shadow-xl">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
              <th className="p-4">Ficha</th>
              <th className="p-4">Paciente</th>
              <th className="p-4">DNI</th>
              <th className="p-4">Teléfono</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-700/50 text-sm">
            {pacientes.length > 0 ? (
              pacientes.map((paciente) => (
                <tr
                  key={paciente.id}
                  className="transition hover:bg-slate-700/40"
                >
                  <td className="p-4 font-bold text-cyan-400">
                    <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1">
                      {paciente.codigo_ficha || 'N/A'}
                    </span>
                  </td>

                  <td className="p-4 font-medium text-white">
                    {paciente.nombre}
                  </td>

                  <td className="p-4 text-slate-300">
                    {paciente.cedula || '—'}
                  </td>

                  <td className="p-4 text-slate-300">
                    {paciente.telefono || '—'}
                  </td>

                  <td className="flex justify-center gap-2 p-4">
                    <button
                      type="button"
                      onClick={() => onVerFicha(paciente)}
                      className="cursor-pointer rounded-lg bg-slate-700/80 p-2 transition hover:bg-cyan-600 hover:text-white"
                      title="Ver Ficha"
                    >
                      📋
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditar(paciente)}
                      className="cursor-pointer rounded-lg bg-slate-700/80 p-2 transition hover:bg-amber-600 hover:text-white"
                      title="Editar Paciente"
                    >
                      <Edit size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onEliminar(paciente.id, paciente.nombre)
                      }
                      className="cursor-pointer rounded-lg bg-slate-700/80 p-2 transition hover:bg-red-600 hover:text-white"
                      title="Eliminar Paciente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-slate-400"
                >
                  No se encontraron pacientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}