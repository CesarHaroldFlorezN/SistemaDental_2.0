import { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  Landmark
} from 'lucide-react';
import {
  construirMovimientosCaja,
  filtrarMovimientosCajaPorPeriodo
} from '../../../app/selectores';

const PERIODOS = [
  ['hoy', 'Hoy'],
  ['semana', 'Esta semana'],
  ['mes', 'Este mes'],
  ['anio', 'Este año'],
  ['historico', 'Desde el inicio']
];

const formatearFechaHora = (valor) => {
  if (!valor) return 'Fecha no disponible';
  const texto = String(valor);
  const fecha = new Date(texto.length === 10 ? `${texto}T12:00:00` : texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  const opciones = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  if (texto.length > 10) {
    opciones.hour = '2-digit';
    opciones.minute = '2-digit';
  }
  return new Intl.DateTimeFormat('es-PE', opciones).format(fecha);
};

export default function ReporteCaja({
  pagos,
  movimientos,
  pacientes,
  formatearMoneda
}) {
  const [periodo, setPeriodo] = useState('hoy');
  const movimientosCaja = useMemo(
    () => construirMovimientosCaja(pagos, movimientos, pacientes),
    [pagos, movimientos, pacientes]
  );
  const visibles = useMemo(
    () => filtrarMovimientosCajaPorPeriodo(movimientosCaja, periodo),
    [movimientosCaja, periodo]
  );
  const totales = useMemo(
    () => visibles.reduce(
      (acumulado, movimiento) => ({
        ingresos: acumulado.ingresos + movimiento.ingreso,
        egresos: acumulado.egresos + movimiento.egreso
      }),
      { ingresos: 0, egresos: 0 }
    ),
    [visibles]
  );
  const neto = totales.ingresos - totales.egresos;

  return (
    <section className="mb-8 rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-xl sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-slate-900 p-2.5 text-white">
            <CalendarRange size={21} />
          </span>
          <div>
            <h2 className="text-lg font-black text-slate-950">Reporte de ingresos y egresos</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-600">
              Pagos recibidos y salidas registradas por anulaciones o devoluciones.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-300 bg-slate-100 p-1.5" role="group" aria-label="Período del reporte de caja">
          {PERIODOS.map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setPeriodo(valor)}
              aria-pressed={periodo === valor}
              className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                periodo === valor
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-700 hover:bg-white hover:text-slate-950'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Resumen
          titulo="Ingresos"
          valor={formatearMoneda(totales.ingresos)}
          Icono={ArrowUpCircle}
          clase="border-emerald-300 bg-emerald-50 text-emerald-800"
        />
        <Resumen
          titulo="Egresos"
          valor={formatearMoneda(totales.egresos)}
          Icono={ArrowDownCircle}
          clase="border-rose-300 bg-rose-50 text-rose-800"
        />
        <Resumen
          titulo="Resultado neto"
          valor={formatearMoneda(neto)}
          Icono={Landmark}
          clase={neto >= 0
            ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
            : 'border-amber-300 bg-amber-50 text-amber-900'}
        />
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-300">
        <table className="min-w-[860px] w-full border-collapse text-left">
          <thead className="bg-slate-900 text-[11px] uppercase tracking-wide text-white">
            <tr>
              <th className="p-3">Fecha y hora</th>
              <th className="p-3">Paciente</th>
              <th className="p-3">Detalle</th>
              <th className="p-3">Método</th>
              <th className="p-3 text-right">Ingreso</th>
              <th className="p-3 text-right">Egreso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-800">
            {visibles.length ? visibles.map((movimiento) => (
              <tr key={movimiento.id} className="bg-white hover:bg-slate-50">
                <td className="whitespace-nowrap p-3 font-semibold text-slate-700">
                  {formatearFechaHora(movimiento.fecha)}
                </td>
                <td className="p-3">
                  <div className="font-black text-slate-950">{movimiento.nombrePaciente}</div>
                  {movimiento.codigoFicha && (
                    <div className="text-xs font-semibold text-slate-500">Ficha {movimiento.codigoFicha}</div>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-semibold text-slate-900">{movimiento.descripcion}</div>
                  <div className="mt-0.5 text-[11px] font-bold uppercase text-slate-500">{String(movimiento.tipo).replaceAll('_', ' ')}</div>
                </td>
                <td className="p-3 font-semibold text-slate-700">
                  {movimiento.metodo}
                  {movimiento.referencia && <div className="text-xs text-slate-500">Ref. {movimiento.referencia}</div>}
                </td>
                <td className="p-3 text-right font-black text-emerald-700">
                  {movimiento.ingreso > 0 ? formatearMoneda(movimiento.ingreso) : '—'}
                </td>
                <td className="p-3 text-right font-black text-rose-700">
                  {movimiento.egreso > 0 ? formatearMoneda(movimiento.egreso) : '—'}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="p-10 text-center font-semibold text-slate-600">
                  No hay ingresos ni egresos registrados en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Resumen({ titulo, valor, Icono, clase }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${clase}`}>
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wide">
        <span>{titulo}</span>
        <Icono size={19} />
      </div>
      <div className="mt-2 font-serif text-2xl font-black">{valor}</div>
    </div>
  );
}
