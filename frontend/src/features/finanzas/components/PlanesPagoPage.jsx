import { PlusCircle, Search, Undo2 } from 'lucide-react';

const obtenerEstadoSesion = (planPago, cuota, planesTratamiento) => {
  if (planPago.origen !== 'plan_tratamiento') return null;
  const plan = planesTratamiento.find(
    (item) => Number(item.id) === Number(planPago.planId)
  );
  return (
    (plan?.sesiones || []).find(
      (sesion) => Number(sesion.id) === Number(cuota.sesionPlanId)
    )?.estado || 'pendiente'
  );
};

export default function PlanesPagoPage({
  planesPago,
  citas,
  planesTratamiento,
  busqueda,
  onCambiarBusqueda,
  onNuevo,
  onEditar,
  onEditarCita,
  onPagarCuota,
  onQuitarCuota,
  onRevertirCuota,
  onAgregarCuota,
  onRegistrarAdelanto,
  onRevertirUltimoAdelanto, // <-- Se recibe la nueva función
  onEliminar,
  formatearMoneda
}) {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">
            Planes de Pago en Cuotas
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Cronogramas de financiamiento, vencimientos y abonos por cuota
          </p>
        </div>
        <button
          type="button"
          onClick={onNuevo}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white shadow-lg transition hover:bg-cyan-500"
        >
          <PlusCircle size={18} /> Nuevo Plan de Pago
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Buscar plan de pago..."
          value={busqueda}
          onChange={(event) => onCambiarBusqueda(event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-500"
        />
      </div>

      <div className="space-y-6">
        {planesPago.length ? (
          planesPago.map((plan) => {
            const cuotas = plan.cuotas || [];
            
            // Re-calculo ultra seguro de lo pagado integrando los montos parciales
            const totalPagado = Number(
              plan.cobrado ??
                Number(plan.anticipo || 0) +
                  cuotas.reduce((total, cuota) => {
                    if (cuota.pagado) return total + Number(cuota.monto || 0);
                    if (cuota.pagadoParcial) return total + Number(cuota.montoPagado || 0);
                    return total;
                  }, 0)
            );
            
            const total = Number.parseFloat(plan.totalAcordado || 0);
            const porcentaje = total > 0
              ? Math.min(100, (totalPagado / total) * 100).toFixed(1)
              : 0;
            const pendientes = cuotas.filter(
              (cuota) =>
                cuota.tipo === 'cuota' &&
                !cuota.pagado &&
                !cuota.cubiertaPorAdelanto
            ).length;
            const citaOrigen = citas.find(
              (cita) => Number(cita.id) === Number(plan.citaId)
            );
            const esTratamiento = plan.origen === 'plan_tratamiento';
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 shadow-xl transition ${
                  esTratamiento
                    ? 'dp-treatment-debt-card border-violet-400/60 bg-violet-950/25 shadow-violet-950/25'
                    : 'border-cyan-500/40 bg-slate-800/80'
                } ${plan.estado !== 'activo' ? 'opacity-85' : ''}`}
              >
                <div className="mb-5 flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg font-bold ${
                        esTratamiento
                          ? 'border-violet-400/60 bg-violet-500/25 text-violet-100'
                          : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                      }`}
                    >
                      {(plan.nombrePaciente || '?').charAt(0)}
                    </div>
                    <div>
                      <div className="text-lg font-bold leading-tight text-white">
                        {plan.nombrePaciente}
                      </div>
                      <div
                        className={`mt-0.5 text-xs font-medium ${
                          esTratamiento ? 'text-violet-200' : 'text-cyan-400'
                        }`}
                      >
                        {plan.concepto || 'Financiamiento Odontológico'}
                      </div>
                      <div
                        className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                          esTratamiento
                            ? 'border-violet-300/60 bg-violet-600 text-white'
                            : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300'
                        }`}
                      >
                        {esTratamiento
                          ? 'Deuda de plan de tratamiento · una cuota por sesión'
                          : 'Procedimiento puntual · cuotas libres'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-300">
                      {esTratamiento
                        ? 'Total del plan clínico'
                        : 'Total de servicios'}
                    </div>
                    <div className="font-serif text-xl font-bold text-white">
                      {formatearMoneda(plan.totalAcordado)}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="h-3 w-full overflow-hidden rounded-full border border-slate-700 bg-slate-900/80">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <Metrica clase="paid" titulo="Pagado / adelantado" valor={formatearMoneda(plan.cobrado)} />
                  <Metrica clase="balance" titulo="Saldo actual" valor={formatearMoneda(plan.saldo)} />
                  <Metrica clase="installments" titulo="Cuotas pendientes" valor={pendientes} />
                </div>

                <div className="mb-5 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800 uppercase text-slate-400">
                        <th className="p-3">Cuota</th>
                        {esTratamiento && <th className="p-3">Sesión clínica</th>}
                        <th className="p-3">Vencimiento</th>
                        <th className="p-3">Monto</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {cuotas.map((cuota, indice) => (
                        <tr key={indice} className="transition hover:bg-slate-800/40">
                          <td className="p-3 font-bold">
                            <span
                              className={`dp-installment-number rounded border px-2 py-1 text-xs font-black ${
                                esTratamiento
                                  ? 'dp-installment-number-treatment border-violet-700 bg-violet-700 text-white'
                                  : 'bg-cyan-500/15 text-cyan-400'
                              }`}
                            >
                              {cuota.tipo === 'anticipo'
                                ? 'Anticipo'
                                : `#${cuota.num}`}
                            </span>
                          </td>
                          {esTratamiento && (
                            <td className="p-3">
                              <div className="dp-treatment-installment-session font-black text-violet-300">
                                Sesión {cuota.sesionNum || cuota.num} ·{' '}
                                {obtenerEstadoSesion(plan, cuota, planesTratamiento)}
                              </div>
                              <div className="dp-treatment-installment-state mt-0.5 text-[11px] font-bold text-slate-500">
                                {cuota.pagado
                                  ? 'Cuota pagada'
                                  : cuota.cubiertaPorAdelanto
                                    ? 'Cubierta por adelanto'
                                    : cuota.pagadoParcial
                                      ? <span className="text-amber-500">Pago parcial (Abonó {formatearMoneda(cuota.montoPagado)})</span>
                                      : 'Pendiente de pago'}
                              </div>
                            </td>
                          )}
                          <td className="p-3 text-slate-300">
                            {cuota.fecha || '—'}
                          </td>
                          <td className="p-3 font-serif font-bold text-white">
                            {formatearMoneda(cuota.monto)}
                            {cuota.pagadoParcial && (
                              <span className="block text-[10.5px] text-amber-400 font-sans mt-0.5 font-normal">
                                De un total de {formatearMoneda(Number(cuota.monto || 0) + Number(cuota.montoPagado || 0))}
                              </span>
                            )}
                          </td>
                          <td className="space-x-1.5 p-3 text-right">
                            {!cuota.pagado && !cuota.cubiertaPorAdelanto ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onPagarCuota(plan, indice)}
                                  className={`cursor-pointer rounded px-2.5 py-1 font-semibold text-white transition ${
                                    cuota.pagadoParcial
                                      ? 'bg-amber-600 hover:bg-amber-500'
                                      : 'bg-emerald-600 hover:bg-emerald-500'
                                  }`}
                                >
                                  💵 {cuota.pagadoParcial 
                                      ? `Completar ${formatearMoneda(cuota.monto)}` 
                                      : (esTratamiento ? `Pagar cuota ${cuota.num}` : 'Pagar')}
                                </button>
                                {!esTratamiento && (
                                  <button
                                    type="button"
                                    onClick={() => onQuitarCuota(plan, indice)}
                                    className="cursor-pointer rounded bg-slate-800 p-1 text-slate-400 transition hover:bg-rose-600/80 hover:text-white"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </>
                            ) : cuota.pagado ? (
                              <button
                                type="button"
                                onClick={() => onRevertirCuota(plan, indice)}
                                className="ml-auto flex cursor-pointer items-center gap-1 rounded bg-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:bg-amber-600/80 hover:text-white"
                              >
                                <Undo2 size={12} /> Revertir
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-300">
                                Adelanto aplicado
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onEditar(plan)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-lg transition ${
                      esTratamiento
                        ? 'bg-violet-600 shadow-violet-950/30 hover:bg-violet-500'
                        : 'bg-cyan-600 shadow-cyan-950/30 hover:bg-cyan-500'
                    }`}
                  >
                    ✏️ Editar plan
                  </button>
                  {citaOrigen && (
                    <button
                      type="button"
                      onClick={() => onEditarCita(citaOrigen)}
                      className="rounded-xl border border-violet-400/60 bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500"
                    >
                      🦷 Editar servicios / deuda
                    </button>
                  )}
                  {!esTratamiento && (
                    <button
                      type="button"
                      onClick={() => onAgregarCuota(plan)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-cyan-600 hover:text-white"
                    >
                      <PlusCircle size={15} /> ＋ Añadir Cuota
                    </button>
                  )}
                  {Number(plan.saldo || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => onRegistrarAdelanto(plan)}
                      className="rounded-xl border border-amber-300 bg-amber-500 px-3.5 py-2 text-xs font-black text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-400"
                    >
                      💵 Registrar adelanto
                    </button>
                  )}
                  
                  {/* NUEVO BOTÓN DE REVERTIR ADELANTO */}
                  {(plan.cuotas?.some(c => c.cubiertaPorAdelanto) || Number(plan.anticipo || 0) > 0) && (
                    <button
                      type="button"
                      onClick={() => onRevertirUltimoAdelanto?.(plan)}
                      className="rounded-xl border border-red-500/50 bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
                      title="Revertir el último pago por adelantado"
                    >
                      ↩️ Revertir adelanto
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEliminar(plan.id)}
                    className="ml-auto rounded-xl border border-rose-400 bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/30 transition hover:bg-rose-500"
                  >
                    🗑 Eliminar plan
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 py-12 text-center">
            <p className="font-medium text-slate-400">
              No se encontraron planes de pago.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Metrica({ clase, titulo, valor }) {
  return (
    <div className={`dp-plan-metric dp-plan-metric-${clase} rounded-xl border p-3`}>
      <div className="dp-plan-metric-label text-[10px] font-bold uppercase tracking-wide">
        {titulo}
      </div>
      <div className="dp-plan-metric-value mt-1 text-lg font-black">{valor}</div>
    </div>
  );
}