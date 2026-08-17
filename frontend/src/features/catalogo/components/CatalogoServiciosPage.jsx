import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleDollarSign,
  Pencil,
  Plus,
  Save,
  Search,
  Tags,
  X,
  XCircle
} from 'lucide-react';
import { api } from '../../../services/api';
import { normalizarTextoCatalogo } from '../../../shared/utils/catalogo';

const ESTADO_VACIO = {
  nombre: '',
  categoria: '',
  precio: '',
  activo: true
};

const moneda = (valor) =>
  `S/. ${Number(valor || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export default function CatalogoServiciosPage({
  servicios = [],
  onRecargar
}) {
  const [busqueda, setBusqueda] = useState('');
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [servicioEditado, setServicioEditado] = useState(null);
  const [formData, setFormData] = useState(ESTADO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const categorias = useMemo(
    () =>
      [...new Set(servicios.map((servicio) => servicio.categoria).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es')),
    [servicios]
  );

  const filtrados = useMemo(() => {
    const termino = normalizarTextoCatalogo(busqueda);
    return servicios.filter((servicio) =>
      normalizarTextoCatalogo(
        `${servicio.nombre} ${servicio.categoria} ${servicio.codigo}`
      ).includes(termino)
    );
  }, [busqueda, servicios]);

  const activos = servicios.filter((servicio) => servicio.activo).length;
  const sinPrecio = servicios.filter(
    (servicio) => servicio.activo && Number(servicio.precio || 0) <= 0
  ).length;

  const abrirNuevo = () => {
    setServicioEditado(null);
    setFormData(ESTADO_VACIO);
    setMensaje(null);
    setFormularioAbierto(true);
  };

  const abrirEdicion = (servicio) => {
    setServicioEditado(servicio);
    setFormData({
      nombre: servicio.nombre,
      categoria: servicio.categoria,
      precio: Number(servicio.precio || 0),
      activo: Boolean(servicio.activo)
    });
    setMensaje(null);
    setFormularioAbierto(true);
  };

  const cerrarFormulario = () => {
    setFormularioAbierto(false);
    setServicioEditado(null);
    setFormData(ESTADO_VACIO);
  };

  const guardar = async (event) => {
    event.preventDefault();
    setMensaje(null);

    const payload = {
      nombre: formData.nombre.trim(),
      categoria: formData.categoria.trim(),
      precio: Math.max(0, Number(formData.precio || 0)),
      activo: formData.activo
    };

    try {
      setGuardando(true);
      if (servicioEditado) {
        await api.actualizarServicioCatalogo(servicioEditado.id, payload);
      } else {
        await api.crearServicioCatalogo(payload);
      }
      await onRecargar();
      cerrarFormulario();
      setMensaje({
        tipo: 'exito',
        texto: servicioEditado
          ? 'Servicio actualizado correctamente.'
          : 'Servicio agregado al catálogo.'
      });
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="dp-catalog space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black text-cyan-700">
            <Tags size={28} /> Catálogo de tratamientos y precios
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Un solo nombre y precio de referencia para agenda, cobros y reportes.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 font-black text-white shadow-lg hover:bg-cyan-800"
        >
          <Plus size={18} /> Nuevo servicio
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Resumen titulo="Servicios registrados" valor={servicios.length} clase="total" />
        <Resumen titulo="Activos" valor={activos} clase="activo" />
        <Resumen titulo="Precios por configurar" valor={sinPrecio} clase="pendiente" />
      </section>

      {mensaje && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${
            mensaje.tipo === 'error'
              ? 'border-rose-500 bg-rose-50 text-rose-900'
              : 'border-emerald-500 bg-emerald-50 text-emerald-900'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {formularioAbierto && (
        <form
          onSubmit={guardar}
          className="rounded-2xl border-2 border-cyan-600 bg-white p-5 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                {servicioEditado ? 'Editar servicio' : 'Crear servicio'}
              </h2>
              <p className="text-xs font-medium text-slate-600">
                Los servicios desactivados permanecen en el historial clínico.
              </p>
            </div>
            <button
              type="button"
              onClick={cerrarFormulario}
              className="rounded-lg border border-slate-400 p-2 text-slate-700 hover:bg-slate-100"
              aria-label="Cerrar formulario"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_180px_auto] lg:items-end">
            <label className="text-sm font-bold text-slate-900">
              Nombre canónico
              <input
                required
                minLength={2}
                value={formData.nombre}
                onChange={(event) =>
                  setFormData((actual) => ({
                    ...actual,
                    nombre: event.target.value
                  }))
                }
                className="mt-1.5 w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-slate-950 outline-none focus:border-cyan-700"
                placeholder="Ej.: Ortodoncia — colocación"
              />
            </label>
            <label className="text-sm font-bold text-slate-900">
              Especialidad / categoría
              <input
                required
                list="categorias-catalogo"
                value={formData.categoria}
                onChange={(event) =>
                  setFormData((actual) => ({
                    ...actual,
                    categoria: event.target.value
                  }))
                }
                className="mt-1.5 w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-slate-950 outline-none focus:border-cyan-700"
                placeholder="Ej.: Ortodoncia"
              />
              <datalist id="categorias-catalogo">
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria} />
                ))}
              </datalist>
            </label>
            <label className="text-sm font-bold text-slate-900">
              Precio de referencia (S/.)
              <input
                type="number"
                data-money-input="true"
                min="0"
                step="0.01"
                value={formData.precio}
                onChange={(event) =>
                  setFormData((actual) => ({
                    ...actual,
                    precio: event.target.value
                  }))
                }
                className="mt-1.5 w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-right font-black text-slate-950 outline-none focus:border-cyan-700"
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-slate-400 bg-slate-50 px-3 font-bold text-slate-900">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(event) =>
                  setFormData((actual) => ({
                    ...actual,
                    activo: event.target.checked
                  }))
                }
                className="h-4 w-4 accent-cyan-700"
              />
              Activo
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrarFormulario}
              className="rounded-xl border-2 border-slate-500 bg-white px-4 py-2.5 font-bold text-slate-800 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 font-black text-white hover:bg-cyan-800 disabled:opacity-60"
            >
              <Save size={17} /> {guardando ? 'Guardando…' : 'Guardar servicio'}
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700"
        />
        <input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre, especialidad o código…"
          className="w-full rounded-xl border-2 border-slate-400 bg-white py-3 pl-11 pr-4 font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-700"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-slate-300 bg-white shadow-xl">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b-2 border-slate-300 bg-slate-100 text-xs uppercase tracking-wide text-slate-800">
            <tr>
              <th className="p-4">Tratamiento / servicio</th>
              <th className="p-4">Especialidad</th>
              <th className="p-4 text-right">Precio</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {filtrados.map((servicio) => (
              <tr key={servicio.id} className="hover:bg-cyan-50">
                <td className="p-4">
                  <div className="font-black text-slate-950">{servicio.nombre}</div>
                  <div className="mt-1 font-mono text-[10px] font-bold text-slate-600">
                    {servicio.codigo}
                  </div>
                </td>
                <td className="p-4 font-bold text-slate-800">
                  {servicio.categoria}
                </td>
                <td className="p-4 text-right">
                  <div className="font-black text-slate-950">
                    {moneda(servicio.precio)}
                  </div>
                  {Number(servicio.precio || 0) <= 0 && (
                    <div className="text-[10px] font-black uppercase text-amber-800">
                      Por configurar
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${
                      servicio.activo
                        ? 'border-emerald-600 bg-emerald-100 text-emerald-950'
                        : 'border-slate-500 bg-slate-200 text-slate-900'
                    }`}
                  >
                    {servicio.activo ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <XCircle size={14} />
                    )}
                    {servicio.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    onClick={() => abrirEdicion(servicio)}
                    className="dp-catalog-edit-action inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtrados.length && (
          <div className="p-10 text-center font-bold text-slate-700">
            No se encontraron servicios con ese criterio.
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-cyan-700 bg-cyan-50 p-4 text-sm font-semibold text-cyan-950">
        <CircleDollarSign size={18} className="mt-0.5 shrink-0" />
        El precio es una referencia automática: todavía puede ajustarse en cada
        atención. Los registros históricos conservan su importe original.
      </p>
    </div>
  );
}

function Resumen({ titulo, valor, clase }) {
  return (
    <div className={`dp-catalog-summary dp-catalog-summary-${clase} rounded-xl border-2 p-4`}>
      <div className="text-xs font-black uppercase tracking-wide">{titulo}</div>
      <div className="mt-1 text-3xl font-black">{valor}</div>
    </div>
  );
}
