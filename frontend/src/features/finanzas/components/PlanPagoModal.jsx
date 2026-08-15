import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CreditCard, Link2, Save, User, X } from 'lucide-react';

const fechaLocal = () => {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sumarDias = (fecha, dias) => {
  const resultado = new Date(`${fecha}T12:00:00`);
  resultado.setDate(resultado.getDate() + dias);
  return resultado.toISOString().split('T')[0];
};

const estadoInicial = (datosIniciales, pacientes) => {
  const esTratamiento = datosIniciales?.origen === 'plan_tratamiento' || Boolean(datosIniciales?.planId);
  const cuotas = Array.isArray(datosIniciales?.cuotas) ? datosIniciales.cuotas : [];
  const pendientes = cuotas.filter((cuota) => cuota.tipo === 'cuota' && !cuota.pagado);
  const primeraPendiente = pendientes[0];
  return {
    pacienteId: datosIniciales?.pacienteId || pacientes[0]?.id || '',
    pagoId: datosIniciales?.pagoId || '',
    citaId: datosIniciales?.citaId || '',
    casoClinicoId: datosIniciales?.casoClinicoId || '',
    planId: datosIniciales?.planId || '',
    origen: esTratamiento ? 'plan_tratamiento' : 'procedimiento',
    concepto: datosIniciales?.concepto || 'Tratamiento odontológico',
    totalAcordado: datosIniciales?.totalAcordado ?? datosIniciales?.total ?? '',
    yaPagado: Number(datosIniciales?.cobrado || 0),
    anticipo: Number(datosIniciales?.anticipo ?? datosIniciales?.cobrado ?? 0),
    metodoPreferido: datosIniciales?.metodoPreferido || 'Por definir',
    nCuotas: datosIniciales?.id
      ? pendientes.length
      : esTratamiento
        ? Number(datosIniciales?.nSesiones || datosIniciales?.sesiones?.length || 1)
        : Number(datosIniciales?.nCuotas || 3),
    intervalo: 30,
    fechaPrimeraCuota: primeraPendiente?.fecha || fechaLocal(),
    sesiones: datosIniciales?.sesiones || cuotas.map((cuota) => ({
      id: cuota.sesionPlanId,
      numero: cuota.sesionNum || cuota.num
    }))
  };
};

export default function PlanPagoModal({
  isOpen,
  onClose,
  onSave,
  pacientes = [],
  pagos = [],
  planes = [],
  planPagos = [],
  datosIniciales = null
}) {
  const [formData, setFormData] = useState(() => estadoInicial(datosIniciales, pacientes));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(estadoInicial(datosIniciales, pacientes));
    setGuardando(false);
  }, [isOpen, datosIniciales, pacientes]);

  const esEdicion = Boolean(datosIniciales?.id);
  const esTratamiento = formData.origen === 'plan_tratamiento';
  const paciente = pacientes.find((item) => Number(item.id) === Number(formData.pacienteId));
  const pagosYaFinanciados = new Set(planPagos.map((plan) => Number(plan.pagoId)).filter(Boolean));
  const deudasDisponibles = pagos.filter(
    (pago) => Number(pago.pacienteId) === Number(formData.pacienteId)
      && Number(pago.saldo || 0) > 0
      && (!pagosYaFinanciados.has(Number(pago.id)) || Number(pago.id) === Number(formData.pagoId))
  );
  const total = Math.max(0, Number(formData.totalAcordado) || 0);
  const yaPagado = Math.min(total, Math.max(0, Number(formData.yaPagado) || 0));
  const saldoFinanciar = Math.max(0, total - yaPagado);
  const cuotasOriginales = Array.isArray(datosIniciales?.cuotas) ? datosIniciales.cuotas : [];
  const cuotasPagadas = cuotasOriginales
    .filter((cuota) => cuota.tipo === 'cuota' && cuota.pagado)
    .map((cuota) => ({ ...cuota }));
  const cuotasPendientes = cuotasOriginales
    .filter((cuota) => cuota.tipo === 'cuota' && !cuota.pagado);

  const cuotasPreview = useMemo(() => {
    const cantidadSolicitada = Number.parseInt(formData.nCuotas, 10) || 0;
    const cantidad = esEdicion && saldoFinanciar <= 0
      ? 0
      : Math.max(1, cantidadSolicitada || 1);
    if (cantidad === 0) return [];
    const intervalo = Math.max(1, Number.parseInt(formData.intervalo, 10) || 30);
    const centavos = Math.round(saldoFinanciar * 100);
    const base = Math.floor(centavos / cantidad);
    const sobrante = centavos - base * cantidad;
    const numerosOcupados = new Set(cuotasPagadas.map((cuota) => Number(cuota.num)));
    let siguienteNumero = 1;

    return Array.from({ length: cantidad }, (_, indice) => {
      const cuotaAnterior = esEdicion ? cuotasPendientes[indice] || null : null;
      const sesion = esEdicion && esTratamiento
        ? cuotaAnterior
        : formData.sesiones[indice] || null;
      while (numerosOcupados.has(siguienteNumero)) siguienteNumero += 1;
      const numero = esTratamiento && cuotaAnterior
        ? Number(cuotaAnterior.num)
        : siguienteNumero++;
      return {
        ...(cuotaAnterior || {}),
        num: numero,
        tipo: 'cuota',
        fecha: sumarDias(formData.fechaPrimeraCuota, indice * intervalo),
        monto: (base + (indice < sobrante ? 1 : 0)) / 100,
        pagado: false,
        fechaPago: null,
        metodoPago: null,
        sesionPlanId: esTratamiento
          ? sesion?.sesionPlanId || sesion?.id || null
          : null,
        sesionNum: esTratamiento
          ? sesion?.sesionNum || sesion?.numero || numero
          : null
      };
    });
  }, [cuotasPagadas, cuotasPendientes, esEdicion, esTratamiento, formData.fechaPrimeraCuota, formData.intervalo, formData.nCuotas, formData.sesiones, saldoFinanciar]);
  const cuotasCronograma = esEdicion
    ? [...cuotasPagadas, ...cuotasPreview].sort((a, b) => Number(a.num) - Number(b.num))
    : cuotasPreview;

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      if (name === 'pacienteId') {
        return {
          ...prev,
          pacienteId: value,
          pagoId: '',
          citaId: '',
          casoClinicoId: '',
          planId: '',
          origen: 'procedimiento',
          concepto: '',
          totalAcordado: '',
          yaPagado: 0,
          nCuotas: 3,
          sesiones: []
        };
      }
      if (name === 'pagoId') {
        const pago = pagos.find((item) => Number(item.id) === Number(value));
        const plan = planes.find((item) => Number(item.id) === Number(pago?.planId));
        return {
          ...prev,
          pagoId: value,
          citaId: pago?.citaId || '',
          casoClinicoId: pago?.casoClinicoId || '',
          planId: pago?.planId || '',
          origen: plan ? 'plan_tratamiento' : 'procedimiento',
          concepto: pago?.concepto || '',
          totalAcordado: pago?.total ?? '',
          yaPagado: Number(pago?.cobrado || 0),
          nCuotas: plan ? Number(plan.nSesiones || 1) : 3,
          sesiones: plan?.sesiones || []
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.pacienteId || !formData.pagoId || total <= 0) return;
    if (!esEdicion && saldoFinanciar <= 0) return;

    const payload = {
      pacienteId: Number(formData.pacienteId),
      pagoId: Number(formData.pagoId) || null,
      citaId: Number(formData.citaId) || null,
      casoClinicoId: Number(formData.casoClinicoId) || null,
      planId: Number(formData.planId) || null,
      origen: formData.origen,
      concepto: formData.concepto.trim(),
      totalAcordado: total,
      anticipo: esEdicion ? Number(formData.anticipo || 0) : yaPagado,
      metodoPreferido: formData.metodoPreferido,
      estado: saldoFinanciar <= 0 ? 'completado' : 'activo',
      cuotas: cuotasCronograma,
      totalCuotas: cuotasCronograma.reduce((suma, cuota) => suma + Number(cuota.monto || 0), 0),
      cobrado: yaPagado,
      saldo: saldoFinanciar,
      fechaCreacion: fechaLocal(),
      creadoEn: new Date().toISOString()
    };

    try {
      setGuardando(true);
      await onSave(payload, esEdicion ? datosIniciales.id : null);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-cyan-400"><CreditCard size={20} /> {esEdicion ? 'Editar plan de pago' : 'Crear plan de pago en cuotas'}</h2>
            <p className="mt-1 text-xs text-slate-500">{esEdicion ? 'Edita el concepto y reprograma únicamente las cuotas pendientes.' : 'La deuda queda vinculada a su origen clínico, sin volver a escribir paciente ni monto.'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-6 text-sm">
          {datosIniciales && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">
              <Link2 size={18} className="mt-0.5 shrink-0" />
              <div><strong>{esEdicion ? 'Edición financiera protegida.' : 'Vinculación automática activa.'}</strong><div className="mt-0.5 text-xs text-slate-400">{esEdicion ? 'Los pagos realizados no se modifican. El total proviene de los servicios de la cita.' : `Este cronograma actualizará la deuda de ${esTratamiento ? 'todo el plan de tratamiento' : 'esta atención puntual'}.`}</div></div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><User size={15} className="text-cyan-400" />Paciente *</span>
              <select name="pacienteId" required disabled={Boolean(datosIniciales?.pacienteId)} value={formData.pacienteId} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 disabled:opacity-70">
                <option value="">Selecciona un paciente</option>
                {pacientes.map((item) => <option key={item.id} value={item.id}>{item.codigo_ficha ? `[${item.codigo_ficha}] ` : ''}{item.nombre}</option>)}
              </select>
            </label>
            <label className="font-medium text-slate-300">Concepto
              <input name="concepto" required value={formData.concepto} onChange={handleChange} readOnly={Boolean(datosIniciales?.concepto) && !esEdicion} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 read-only:opacity-70" />
            </label>
          </div>

          {!datosIniciales && (
            <label className="block font-medium text-slate-300">Deuda a financiar *
              <select name="pagoId" required value={formData.pagoId} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500">
                <option value="">Selecciona una atención o plan con saldo</option>
                {deudasDisponibles.map((pago) => <option key={pago.id} value={pago.id}>{pago.concepto || 'Atención odontológica'} · saldo S/. {Number(pago.saldo || 0).toFixed(2)}</option>)}
              </select>
              {!deudasDisponibles.length && <span className="mt-1 block text-xs text-amber-300">Este paciente no tiene deudas disponibles para financiar.</span>}
            </label>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <label className="font-medium text-slate-300">Monto total (S/.)
              <input type="number" data-money-input="true" min="0.01" step="0.01" name="totalAcordado" required readOnly={Boolean(formData.pagoId)} value={formData.totalAcordado} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-right text-lg font-black text-cyan-300 outline-none read-only:opacity-70" />
            </label>
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div className="text-xs text-slate-500">Ya pagado</div><div className="mt-1 text-lg font-bold text-emerald-400">S/. {yaPagado.toFixed(2)}</div><div className="text-[11px] text-slate-500">Solo lectura; proviene de cobros registrados.</div></div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3"><div className="text-xs text-rose-300">A financiar</div><div className="mt-1 text-lg font-black text-rose-300">S/. {saldoFinanciar.toFixed(2)}</div></div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="font-medium text-slate-300">{esEdicion ? 'Cuotas pendientes' : 'Número de cuotas'}
              <input type="number" min={saldoFinanciar > 0 ? 1 : 0} max="60" name="nCuotas" disabled={esTratamiento || saldoFinanciar <= 0} value={formData.nCuotas} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500 disabled:opacity-60" />
              <span className="mt-1 block text-[11px] text-slate-500">{esTratamiento ? 'Una cuota por cada sesión del tratamiento.' : esEdicion ? 'Las cuotas pagadas quedan protegidas.' : 'Libre para procedimientos pequeños.'}</span>
            </label>
            <label className="font-medium text-slate-300">Frecuencia
              <select name="intervalo" value={formData.intervalo} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"><option value="7">Semanal</option><option value="15">Quincenal</option><option value="30">Mensual</option><option value="60">Bimestral</option></select>
            </label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><CalendarDays size={15} className="text-cyan-400" />Primera cuota</span>
              <input type="date" name="fechaPrimeraCuota" value={formData.fechaPrimeraCuota} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500" />
            </label>
            <label className="font-medium text-slate-300">Método preferido
              <select name="metodoPreferido" value={formData.metodoPreferido} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"><option>Por definir</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select>
            </label>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Cronograma ({cuotasCronograma.length} cuotas)</div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/80">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-800 text-slate-400"><tr><th className="p-3">Cuota</th>{esTratamiento && <th className="p-3">Sesión vinculada</th>}<th className="p-3">Vencimiento</th><th className="p-3 text-right">Monto</th></tr></thead>
                <tbody className="divide-y divide-slate-800">{cuotasCronograma.map((cuota) => <tr key={cuota.num} className={cuota.pagado ? 'opacity-60' : ''}><td className="p-3 font-bold text-cyan-400">#{cuota.num}{cuota.pagado && <span className="ml-2 text-[9px] text-emerald-300">PAGADA</span>}</td>{esTratamiento && <td className="p-3 text-purple-300">Sesión {cuota.sesionNum}</td>}<td className="p-3 text-slate-300">{cuota.fecha}</td><td className="p-3 text-right font-bold text-white">S/. {Number(cuota.monto || 0).toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-5 py-2.5 font-medium text-slate-200 hover:bg-slate-600">Cancelar</button>
            <button type="submit" disabled={guardando || (!esEdicion && saldoFinanciar <= 0) || !paciente || !formData.pagoId} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"><Save size={18} />{guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear cronograma vinculado'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
