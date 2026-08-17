import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const REGISTROS_POR_PAGINA = 25;

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
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(
    1,
    Math.ceil(pacientes.length / REGISTROS_POR_PAGINA)
  );
  const pacientesVisibles = useMemo(() => {
    const inicio = (pagina - 1) * REGISTROS_POR_PAGINA;
    return pacientes.slice(inicio, inicio + REGISTROS_POR_PAGINA);
  }, [pacientes, pagina]);

  useEffect(() => setPagina(1), [busqueda]);
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

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
            className="dp-patient-csv-action dp-patient-csv-export flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-black shadow-md transition"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>

          <label className="dp-patient-csv-action dp-patient-csv-import flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-black shadow-md transition">
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
          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-11 pr-28 text-sm shadow-sm outline-none transition focus:border-cyan-500"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => onCambiarBusqueda('')}
            className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-xs font-black text-white transition hover:bg-cyan-700"
            aria-label="Limpiar búsqueda de pacientes"
          >
            <X size={14} /> Limpiar
          </button>
        )}
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
            {pacientesVisibles.length > 0 ? (
              pacientesVisibles.map((paciente) => (
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
        {pacientes.length > REGISTROS_POR_PAGINA && (
          <div className="flex flex-col gap-3 border-t border-slate-300 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-bold text-slate-600">
              Mostrando {(pagina - 1) * REGISTROS_POR_PAGINA + 1}–
              {Math.min(
                pagina * REGISTROS_POR_PAGINA,
                pacientes.length
              )}{' '}
              de {pacientes.length} pacientes
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                disabled={pagina === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <span className="min-w-24 text-center text-xs font-black text-slate-800">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPagina((actual) => Math.min(totalPaginas, actual + 1))
                }
                disabled={pagina === totalPaginas}
                className="dp-pagination-next inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed"
              >
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
