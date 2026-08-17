import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  DollarSign,
  Search,
  TrendingUp
} from 'lucide-react';
import { useState } from 'react';
import ReporteCaja from './ReporteCaja';

const ETIQUETAS_TIPO_PAGO = {
  contado: 'Contado',
  completo: 'Pagado',
  anticipo: 'Anticipo',
  cuotas: 'Cuotas',
  sesion: 'Plan',
  cortesia: 'Cortesía'
};

const BadgeTipoPago = ({ tipo }) => (
  <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-400">
    {ETIQUETAS_TIPO_PAGO[(tipo || '').toLowerCase()] || tipo || 'Contado'}
  </span>
);

export default function FinanzasPage({
  pagos,
  pagosFiltrados,
  busqueda,
  filtro,
  resumen,
  movimientos = [],
  pacientes = [],
  onCambiarBusqueda,
  onCambiarFiltro,
  onCobrar,
  formatearMoneda
}) {
  const [reporteVisible, setReporteVisible] = useState(false);
  const pendientes = pagos.filter(
    (pago) => Number.parseFloat(pago.saldo || 0) > 0
  ).length;
  const alDia = pagos.length - pendientes;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            Módulo de Finanzas y Cobros
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Historial de pagos, cuotas y cuentas por cobrar
          </p>
        </div>
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-semibold text-cyan-400">
          {pagosFiltrados.length} Movimientos
        </span>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            etiqueta: 'Ingresos del Mes',
            monto: resumen.ingresosMes,
            Icono: TrendingUp,
            clase: 'text-cyan-400'
          },
          {
            etiqueta: 'Total Cobrado',
            monto: resumen.totalCobrado,
            Icono: DollarSign,
            clase: 'text-emerald-400'
          },
          {
            etiqueta: 'Financiado Activo',
            monto: resumen.financiadoActivo,
            Icono: CreditCard,
            clase: 'text-amber-400'
          },
          {
            etiqueta: 'Por Cobrar',
            monto: resumen.porCobrarTotal,
            Icono: AlertTriangle,
            clase: 'text-rose-400'
          }
        ].map(({ etiqueta, monto, Icono, clase }) => (
          <div
            key={etiqueta}
            className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/80 p-5 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>{etiqueta}</span>
              <Icono size={18} className={clase} />
            </div>
            <div className={`font-serif text-2xl font-black ${clase}`}>
              {formatearMoneda(monto)}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 flex flex-col gap-3 rounded-2xl border-2 border-cyan-700/30 bg-cyan-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-black text-slate-950">Reporte detallado de caja</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-600">
            Consulta ingresos, egresos y el resultado neto de cualquier período.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReporteVisible((visible) => !visible)}
          aria-expanded={reporteVisible}
          className="dp-cash-report-toggle inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition"
        >
          <BarChart3 size={18} />
          {reporteVisible ? 'Ocultar reporte' : 'Ver ingresos y egresos'}
        </button>
      </div>

      {reporteVisible && (
        <ReporteCaja
          pagos={pagos}
          movimientos={movimientos}
          pacientes={pacientes}
          formatearMoneda={formatearMoneda}
        />
      )}

      <div className="mb-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por paciente, DNI, ficha, teléfono, tratamiento o método..."
            value={busqueda}
            onChange={(event) => onCambiarBusqueda(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-500"
          />
        </div>
        <div
          className="flex flex-wrap rounded-xl border border-slate-700 bg-slate-800 p-1"
          role="group"
          aria-label="Filtrar movimientos por estado de deuda"
        >
          {[
            ['todos', 'Todos', pagos.length],
            ['pendientes', 'Con saldo', pendientes],
            ['aldia', 'Al día', alDia]
          ].map(([valor, texto, cantidad]) => (
            <button
              key={valor}
              type="button"
              onClick={() => onCambiarFiltro(valor)}
              aria-pressed={filtro === valor}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                filtro === valor
                  ? valor === 'pendientes'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {texto} · {cantidad}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-800/80 shadow-xl">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
              {[
                'Paciente',
                'Tratamiento',
                'Fecha',
                'Total',
                'Cobrado',
                'Saldo',
                'Tipo',
                'Método',
                'Acción'
              ].map((encabezado) => (
                <th key={encabezado} className="p-4">
                  {encabezado}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-sm">
            {pagosFiltrados.length ? (
              pagosFiltrados.map((pago) => {
                const saldo = Number.parseFloat(pago.saldo || 0);
                const cobrado = Number.parseFloat(pago.cobrado || 0);
                const servicios =
                  Array.isArray(pago.servicios) && pago.servicios.length
                    ? pago.servicios
                    : [
                        {
                          nombre: pago.concepto || 'Consulta General',
                          costo: pago.total
                        }
                      ];
                return (
                  <tr key={pago.id} className="transition hover:bg-slate-700/40">
                    <td className="p-4">
                      <div className="font-semibold text-white">
                        {pago.nombrePaciente}
                      </div>
                      <div className="text-xs text-slate-400">
                        {pago.cedulaPaciente !== '—'
                          ? `DNI: ${pago.cedulaPaciente}`
                          : ''}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {servicios.map((servicio, indice) => (
                          <div
                            key={`${pago.id}-servicio-${indice}`}
                            className="flex min-w-[220px] items-start justify-between gap-3 text-xs"
                          >
                            <span className="font-medium text-slate-200">
                              {servicio.nombre}
                            </span>
                            <span className="shrink-0 text-cyan-300">
                              {formatearMoneda(servicio.costo)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-4 text-xs text-slate-400">
                      {pago.fecha || '—'}
                    </td>
                    <td className="p-4 font-serif text-slate-300">
                      {formatearMoneda(pago.total)}
                    </td>
                    <td className="p-4 font-serif font-bold text-emerald-400">
                      {formatearMoneda(cobrado)}
                    </td>
                    <td className="p-4 font-serif font-bold">
                      {saldo > 0 ? (
                        <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-400">
                          {formatearMoneda(saldo)}
                        </span>
                      ) : (
                        <span className="text-emerald-400">✓ Al día</span>
                      )}
                    </td>
                    <td className="p-4">
                      <BadgeTipoPago tipo={pago.tipoPago} />
                    </td>
                    <td className="p-4 text-xs text-slate-300">
                      {pago.metodo || '—'}
                    </td>
                    <td className="p-4 text-center">
                      {saldo > 0 && (
                        <button
                          type="button"
                          onClick={() => onCobrar(pago, pago.nombrePaciente)}
                          className="cursor-pointer rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-500"
                        >
                          💳 Cobrar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="p-12 text-center text-slate-400">
                  {filtro === 'pendientes'
                    ? 'No hay cuentas con saldo pendiente.'
                    : 'No se encontraron registros.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
