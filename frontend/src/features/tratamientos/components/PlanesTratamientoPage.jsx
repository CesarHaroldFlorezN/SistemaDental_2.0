import { FolderPlus, Search } from 'lucide-react';

const ordenarSesiones = (sesiones) =>
  [...(sesiones || [])].sort(
    (a, b) => Number(a.numero) - Number(b.numero)
  );

const estadoPagoSesion = (sesion, cuota) =>
  sesion.estadoPago ||
  (cuota?.pagado
    ? 'pagada'
    : cuota?.cubiertaPorAdelanto
      ? 'cubierta_por_adelanto'
      : cuota
        ? 'pendiente'
        : 'sin_cronograma');

const ETIQUETAS_PAGO = {
  pagada: 'Cuota pagada',
  cubierta_por_adelanto: 'Cubierta por adelanto',
  pendiente: 'Pago pendiente',
  sin_cronograma: 'Sin cuota creada'
};

export default function PlanesTratamientoPage({
  planes,
  pagos,
  planesPago,
  busqueda,
  onCambiarBusqueda,
  onNuevo,
  onEditar,
  onEliminar,
  onPagarCuota,
  onAgendarSesion,
  onCrearCuotas,
  formatearMoneda
}) {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-purple-400">
            Planes de Tratamiento
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Carpetas clínicas, especialidades y control de avance por sesión
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm font-semibold text-purple-400">
            {planes.length} Planes
          </span>
          <button
            type="button"
            onClick={onNuevo}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 font-semibold text-white shadow-lg transition hover:bg-purple-500"
          >
            <FolderPlus size={18} /> Nuevo Plan
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Buscar plan por paciente o nombre del tratamiento..."
          value={busqueda}
          onChange={(event) => onCambiarBusqueda(event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-purple-500"
        />
      </div>

      <div className="space-y-6">
        {planes.length ? (
          planes.map((plan) => {
            const sesiones = ordenarSesiones(plan.sesiones);
            const completadas = sesiones.filter(
              (sesion) => sesion.estado === 'completada'
            ).length;
            const siguienteSesion = sesiones.find(
              (sesion) => sesion.estado === 'pendiente'
            );
            const pago =
              plan.pago ||
              pagos.find((item) => Number(item.id) === Number(plan.pagoId));
            const planPago =
              plan.planPago ||
              planesPago.find(
                (item) => Number(item.planId) === Number(plan.id)
              );
            const cuotas = planPago?.cuotas || [];
            const resumen = plan.resumenFinanciero || {};
            const cuotasPagadas = cuotas.filter(
              (cuota) => cuota.tipo === 'cuota' && cuota.pagado
            );
            const cuotasPendientes = cuotas.filter(
              (cuota) =>
                cuota.tipo === 'cuota' &&
                !cuota.pagado &&
                !cuota.cubiertaPorAdelanto
            );
            const montoPagado = cuotasPagadas.reduce(
              (total, cuota) => total + Number(cuota.monto || 0),
              0
            );
            const montoPendiente = cuotasPendientes.reduce(
              (total, cuota) => total + Number(cuota.monto || 0),
              0
            );
            const total = Number(
              resumen.total ?? pago?.total ?? plan.costo ?? 0
            );
            const cobrado = Number(resumen.cobrado ?? pago?.cobrado ?? 0);
            const saldo = Number(
              resumen.saldo ?? pago?.saldo ?? plan.costo ?? 0
            );
            const adelantado = Number(
              resumen.adelantado ?? planPago?.anticipo ?? 0
            );
            const porcentaje = sesiones.length
              ? Math.round((completadas / sesiones.length) * 100)
              : 0;

            return (
              <div
                key={plan.id}
                className="rounded-2xl border border-purple-500/20 bg-slate-800/80 p-6 shadow-xl transition hover:border-purple-500/40"
              >
                <div className="mb-4 flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 text-lg font-bold text-purple-400">
                      {(plan.nombrePaciente || '?').charAt(0)}
                    </div>
                    <div>
                      <div className="text-lg font-bold leading-tight text-white">
                        {plan.nombrePaciente}{' '}
                        {plan.codigoFicha ? `[${plan.codigoFicha}]` : ''}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-purple-400">
                        {plan.telefonoPaciente || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Presupuesto</div>
                    <div className="font-serif text-xl font-bold text-white">
                      {formatearMoneda(plan.costo)}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-base font-bold text-white">{plan.nombre}</h3>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {plan.tipo} · {plan.duracion}
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/55 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-200">
                      Avance clínico · sesión{' '}
                      {Math.min(completadas + 1, sesiones.length || 1)} de{' '}
                      {sesiones.length || plan.nSesiones}
                    </span>
                    <span className="text-slate-400">{porcentaje}% completado</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {sesiones.map((sesion) => {
                      const indiceCuota = cuotas.findIndex(
                        (cuota) =>
                          Number(cuota.sesionPlanId) === Number(sesion.id) ||
                          Number(cuota.sesionNum || cuota.num) ===
                            Number(sesion.numero)
                      );
                      const cuota =
                        indiceCuota >= 0
                          ? cuotas[indiceCuota]
                          : sesion.cuotaFinanciera;
                      const estadoPago = estadoPagoSesion(sesion, cuota);
                      const claseSesion =
                        sesion.estado === 'completada'
                          ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                          : sesion.estado === 'agendada'
                            ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
                            : 'border-amber-400/60 bg-amber-500/15 text-amber-100';
                      const clasePago =
                        estadoPago === 'pagada'
                          ? 'border-emerald-300/60 bg-emerald-600 text-white'
                          : estadoPago === 'cubierta_por_adelanto'
                            ? 'border-violet-300/60 bg-violet-600 text-white'
                            : estadoPago === 'pendiente'
                              ? 'border-amber-300/60 bg-amber-600 text-white'
                              : 'border-slate-400/50 bg-slate-700 text-slate-100';
                      return (
                        <div
                          key={sesion.id}
                          title={`${sesion.titulo} · ${sesion.fechaProgramada || 'sin fecha'}`}
                          className={`flex min-w-[150px] flex-col rounded-xl border p-3 text-left shadow-sm ${claseSesion}`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-black">
                              Sesión {sesion.numero}
                            </span>
                            <span className="rounded-full bg-slate-950/35 px-2 py-0.5 text-[9px] font-black uppercase">
                              {sesion.estado}
                            </span>
                          </span>
                          {sesion.fechaProgramada && (
                            <span className="mt-1 text-[10px] font-semibold">
                              {sesion.fechaProgramada}
                            </span>
                          )}
                          <span className="mt-3 border-t border-current/20 pt-2 text-[10px] font-bold uppercase opacity-80">
                            Monto vinculado
                          </span>
                          <span className="mt-0.5 text-base font-black text-white">
                            {cuota ? formatearMoneda(cuota.monto) : '—'}
                          </span>
                          <span
                            className={`mt-2 rounded-lg border px-2 py-1 text-center text-[10px] font-black ${clasePago}`}
                          >
                            {ETIQUETAS_PAGO[estadoPago]}
                          </span>
                          {estadoPago === 'pendiente' &&
                            planPago &&
                            indiceCuota >= 0 && (
                              <button
                                type="button"
                                onClick={() => onPagarCuota(planPago, indiceCuota)}
                                className="mt-2 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500"
                              >
                                Pagar esta cuota
                              </button>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metrica titulo="Costo del plan" valor={formatearMoneda(total)} />
                  <Metrica
                    variante="pagado"
                    titulo="Pagado / adelantado"
                    valor={formatearMoneda(cobrado)}
                    detalle={`Cuotas: ${formatearMoneda(montoPagado)} · Adelanto: ${formatearMoneda(adelantado)}`}
                  />
                  <Metrica
                    variante="saldo"
                    titulo="Saldo actual"
                    valor={formatearMoneda(saldo)}
                  />
                  <Metrica
                    variante="pendiente"
                    titulo="Cuotas pendientes"
                    valor={cuotasPendientes.length}
                    detalle={`Monto vinculado: ${formatearMoneda(montoPendiente)}`}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={!siguienteSesion}
                    onClick={() => onAgendarSesion(plan, siguienteSesion)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    📅{' '}
                    {siguienteSesion
                      ? `Agendar sesión ${siguienteSesion.numero}`
                      : 'Todas agendadas'}
                  </button>
                  {!planPago && Number(pago?.saldo || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => onCrearCuotas(plan, pago, sesiones)}
                      className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-600 hover:text-white"
                    >
                      💳 Crear {sesiones.length} cuotas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEditar(plan)}
                    className="cursor-pointer rounded-xl bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-amber-600 hover:text-white"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onEliminar(plan.id, plan.nombre)}
                    className="ml-auto cursor-pointer rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-600 hover:text-white"
                  >
                    🗑 Eliminar Plan
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 py-12 text-center">
            <p className="font-medium text-slate-400">
              No hay carpetas de planes registradas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Metrica({ titulo, valor, detalle, variante = 'base' }) {
  const clases = {
    base: 'border-slate-500/50 bg-slate-700/60 text-slate-200',
    pagado: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100',
    saldo: 'border-rose-400/50 bg-rose-500/15 text-rose-100',
    pendiente: 'border-amber-400/60 bg-amber-500/15 text-amber-100'
  };
  return (
    <div className={`rounded-xl border p-3 ${clases[variante]}`}>
      <div className="text-[10px] font-bold uppercase">{titulo}</div>
      <div className="mt-1 text-lg font-black">{valor}</div>
      {detalle && <div className="mt-1 text-[10px] font-semibold">{detalle}</div>}
    </div>
  );
}
