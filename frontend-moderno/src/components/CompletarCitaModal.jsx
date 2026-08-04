import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Gift,
  ListPlus,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';

const SERVICIOS_SUGERIDOS = [
  'Consulta de evaluación',
  'Profilaxis / Limpieza dental',
  'Empaste / Resina',
  'Endodoncia',
  'Extracción simple',
  'Extracción de muela del juicio',
  'Corona dental',
  'Implante dental',
  'Blanqueamiento',
  'Ortodoncia — colocación',
  'Ortodoncia — control',
  'Prótesis dental',
  'Radiografía dental',
  'Cirugía oral'
];

const METODOS_PAGO = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta'];

const moneda = (valor) =>
  `S/. ${Number(valor || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const crearClave = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const serviciosIniciales = (cita) => {
  const base = Array.isArray(cita?.servicios) && cita.servicios.length
    ? cita.servicios
    : [{ nombre: cita?.procedimiento || 'Consulta de evaluación', costo: cita?.costo || 0 }];

  return base.map((servicio) => ({
    clave: crearClave(),
    nombre: servicio?.nombre || 'Servicio dental',
    costo: Math.max(0, Number(servicio?.costo || 0)),
    realizado: true,
    origen: 'programado'
  }));
};

export default function CompletarCitaModal({ isOpen, onClose, onSave, cita, pago }) {
  const [servicios, setServicios] = useState([]);
  const [ajusteTipo, setAjusteTipo] = useState('ninguno');
  const [ajusteMonto, setAjusteMonto] = useState(0);
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [accionSaldo, setAccionSaldo] = useState('cobrar_ahora');
  const [montoCobrar, setMontoCobrar] = useState(0);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [pagosMixtos, setPagosMixtos] = useState([
    { clave: crearClave(), metodo: 'Efectivo', monto: 0 },
    { clave: crearClave(), metodo: 'Yape', monto: 0 }
  ]);
  const [notasFin, setNotasFin] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen || !cita) return;
    const iniciales = serviciosIniciales(cita);
    const totalInicial = iniciales.reduce((total, servicio) => total + servicio.costo, 0);
    const pagado = Math.max(0, Number(pago?.cobrado || 0));
    const saldo = Math.max(0, totalInicial - pagado);

    setServicios(iniciales);
    setAjusteTipo('ninguno');
    setAjusteMonto(0);
    setAjusteMotivo('');
    setAccionSaldo(saldo > 0 ? 'cobrar_ahora' : 'dejar_pendiente');
    setMontoCobrar(saldo);
    setMetodoPago('Efectivo');
    setPagosMixtos([
      { clave: crearClave(), metodo: 'Efectivo', monto: saldo },
      { clave: crearClave(), metodo: 'Yape', monto: 0 }
    ]);
    setNotasFin(cita?.notasFin || '');
    setError('');
    setGuardando(false);
  }, [isOpen, cita, pago]);

  const serviciosRealizados = useMemo(
    () => servicios.filter((servicio) => servicio.realizado && servicio.nombre.trim()),
    [servicios]
  );

  const serviciosNoRealizados = useMemo(
    () => servicios.filter((servicio) => !servicio.realizado && servicio.nombre.trim()),
    [servicios]
  );

  const subtotal = useMemo(
    () => serviciosRealizados.reduce(
      (total, servicio) => total + Math.max(0, Number(servicio.costo || 0)),
      0
    ),
    [serviciosRealizados]
  );

  const ajusteSolicitado = ajusteTipo === 'ninguno'
    ? 0
    : Math.max(0, Number(ajusteMonto || 0));
  const ajusteAplicado = Math.min(subtotal, ajusteSolicitado);
  const totalFinal = Math.max(0, subtotal - ajusteAplicado);
  const pagadoAnterior = Math.max(0, Number(pago?.cobrado || 0));
  const creditoPrevio = Math.max(0, pagadoAnterior - totalFinal);
  const saldoAntesCobro = Math.max(0, totalFinal - pagadoAnterior);
  const cobroHoy = accionSaldo === 'cobrar_ahora'
    ? Math.max(0, Number(montoCobrar || 0))
    : 0;
  const saldoFinal = Math.max(0, saldoAntesCobro - cobroHoy);
  const totalMixto = pagosMixtos.reduce(
    (total, parte) => total + Math.max(0, Number(parte.monto || 0)),
    0
  );

  useEffect(() => {
    if (!isOpen) return;
    if (accionSaldo === 'cobrar_ahora') {
      setMontoCobrar(saldoAntesCobro);
      setPagosMixtos((actuales) => {
        const copia = actuales.length ? [...actuales] : [
          { clave: crearClave(), metodo: 'Efectivo', monto: 0 },
          { clave: crearClave(), metodo: 'Yape', monto: 0 }
        ];
        return copia.map((parte, indice) => ({
          ...parte,
          monto: indice === 0 ? saldoAntesCobro : 0
        }));
      });
    }
  }, [saldoAntesCobro, accionSaldo, isOpen]);

  if (!isOpen || !cita) return null;

  const actualizarServicio = (clave, campo, valor) => {
    setError('');
    setServicios((actuales) => actuales.map((servicio) =>
      servicio.clave === clave
        ? {
            ...servicio,
            [campo]: campo === 'costo' ? Math.max(0, Number(valor || 0)) : valor
          }
        : servicio
    ));
  };

  const agregarServicio = () => {
    setServicios((actuales) => [
      ...actuales,
      {
        clave: crearClave(),
        nombre: 'Profilaxis / Limpieza dental',
        costo: 0,
        realizado: true,
        origen: 'adicional'
      }
    ]);
  };

  const eliminarServicio = (clave) => {
    setServicios((actuales) => actuales.filter((servicio) => servicio.clave !== clave));
  };

  const actualizarPagoMixto = (clave, campo, valor) => {
    setError('');
    setPagosMixtos((actuales) => actuales.map((parte) =>
      parte.clave === clave
        ? { ...parte, [campo]: campo === 'monto' ? Math.max(0, Number(valor || 0)) : valor }
        : parte
    ));
  };

  const agregarPartePago = () => {
    setPagosMixtos((actuales) => [
      ...actuales,
      { clave: crearClave(), metodo: 'Efectivo', monto: 0 }
    ]);
  };

  const eliminarPartePago = (clave) => {
    setPagosMixtos((actuales) => actuales.length <= 2
      ? actuales
      : actuales.filter((parte) => parte.clave !== clave));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!serviciosRealizados.length) {
      setError('Debes dejar por lo menos un servicio marcado como realizado.');
      return;
    }

    if (serviciosRealizados.some((servicio) => !servicio.nombre.trim())) {
      setError('Todos los servicios realizados deben tener un nombre.');
      return;
    }

    if (ajusteSolicitado > subtotal) {
      setError('El descuento o ajuste no puede superar el subtotal realizado.');
      return;
    }

    if (ajusteTipo !== 'ninguno' && ajusteAplicado > 0 && !ajusteMotivo.trim()) {
      setError('Indica el motivo del descuento, cortesía o ajuste.');
      return;
    }

    if (accionSaldo === 'cobrar_ahora') {
      if (saldoAntesCobro <= 0) {
        setError('Esta atención ya no tiene saldo por cobrar.');
        return;
      }
      if (cobroHoy <= 0 || cobroHoy > saldoAntesCobro) {
        setError(`El monto a cobrar debe ser mayor que cero y no superar ${moneda(saldoAntesCobro)}.`);
        return;
      }
      if (metodoPago === 'Mixto' && Math.abs(totalMixto - cobroHoy) > 0.009) {
        setError(`El detalle del pago mixto debe sumar exactamente ${moneda(cobroHoy)}.`);
        return;
      }
    }

    const payload = {
      citaId: cita.id,
      pacienteId: cita.pacienteId,
      citaBaseId: cita.citaBaseId || null,
      serviciosRealizados: serviciosRealizados.map((servicio) => ({
        nombre: servicio.nombre.trim(),
        costo: Number(servicio.costo || 0),
        origen: servicio.origen
      })),
      serviciosNoRealizados: serviciosNoRealizados.map((servicio) => ({
        nombre: servicio.nombre.trim(),
        costo: Number(servicio.costo || 0),
        origen: servicio.origen
      })),
      procedimiento: serviciosRealizados.map((servicio) => servicio.nombre.trim()).join(' + '),
      subtotal,
      ajuste: {
        tipo: ajusteTipo,
        monto: ajusteAplicado,
        motivo: ajusteMotivo.trim()
      },
      totalFinal,
      pagadoAnterior,
      accionSaldo,
      cobroHoy,
      metodoPago: accionSaldo === 'cobrar_ahora' ? metodoPago : 'Pendiente',
      pagosMixtos: metodoPago === 'Mixto'
        ? pagosMixtos
            .filter((parte) => Number(parte.monto || 0) > 0)
            .map((parte) => ({ metodo: parte.metodo, monto: Number(parte.monto || 0) }))
        : [],
      notasFin: notasFin.trim()
    };

    try {
      setGuardando(true);
      await onSave(payload);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-400">
              <CheckCircle2 size={21} /> Cerrar atención
            </h2>
            <p className="mt-1 text-sm font-semibold text-white">{cita.nombrePaciente || 'Paciente'}</p>
            <p className="mt-0.5 text-xs text-slate-500">Revisa lo realizado, agrega servicios y define cómo quedará el saldo.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-5 text-sm sm:p-6">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 font-medium text-rose-300">
              {error}
            </div>
          )}

          <section className="rounded-2xl border border-slate-700 bg-slate-900/45 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-white"><ReceiptText size={17} className="text-cyan-400" /> Servicios realizados hoy</h3>
                <p className="mt-1 text-xs text-slate-500">Desmarca lo que no se realizó y agrega cualquier procedimiento solicitado durante la atención.</p>
              </div>
              <button type="button" onClick={agregarServicio} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-cyan-500"><ListPlus size={16} /> Agregar servicio</button>
            </div>

            <datalist id="servicios-dentales-v7">
              {SERVICIOS_SUGERIDOS.map((servicio) => <option key={servicio} value={servicio} />)}
            </datalist>

            <div className="space-y-3">
              {servicios.map((servicio, indice) => (
                <div key={servicio.clave} className={`rounded-xl border p-3.5 transition ${servicio.realizado ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/60 opacity-70'}`}>
                  <div className="grid gap-3 md:grid-cols-[115px_minmax(0,1fr)_150px_42px] md:items-end">
                    <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-bold text-slate-300">
                      <input type="checkbox" checked={servicio.realizado} onChange={(event) => actualizarServicio(servicio.clave, 'realizado', event.target.checked)} className="h-4 w-4 accent-emerald-500" />
                      {servicio.realizado ? 'Realizado' : 'No realizado'}
                    </label>
                    <label className="text-xs font-medium text-slate-400">Servicio {indice + 1}
                      <input list="servicios-dentales-v7" type="text" value={servicio.nombre} onChange={(event) => actualizarServicio(servicio.clave, 'nombre', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 font-semibold text-white outline-none focus:border-cyan-500" />
                    </label>
                    <label className="text-xs font-medium text-slate-400">Precio (S/.)
                      <input type="number" min="0" step="0.01" value={servicio.costo} onChange={(event) => actualizarServicio(servicio.clave, 'costo', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right font-bold text-white outline-none focus:border-cyan-500" />
                    </label>
                    <button type="button" disabled={servicio.origen === 'programado'} onClick={() => eliminarServicio(servicio.clave)} title={servicio.origen === 'programado' ? 'Los servicios programados se desmarcan, no se borran' : 'Eliminar servicio adicional'} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-500 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-25"><Trash2 size={16} /></button>
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{servicio.origen === 'programado' ? 'Programado previamente' : 'Agregado durante la atención'}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
            <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div className="mb-4">
                <h3 className="flex items-center gap-2 font-bold text-white"><Gift size={17} className="text-amber-300" /> Descuento, cortesía o ajuste</h3>
                <p className="mt-1 text-xs text-slate-500">El precio original queda visible y el ajuste se registra por separado.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-400">Tipo de ajuste
                  <select value={ajusteTipo} onChange={(event) => { setAjusteTipo(event.target.value); if (event.target.value === 'ninguno') { setAjusteMonto(0); setAjusteMotivo(''); } }} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-amber-500">
                    <option value="ninguno">Sin ajuste</option>
                    <option value="descuento">Descuento autorizado</option>
                    <option value="cortesia">Cortesía profesional</option>
                    <option value="promocion">Promoción</option>
                    <option value="garantia">Garantía / retratamiento</option>
                    <option value="otro">Otro ajuste</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-400">Monto del ajuste (S/.)
                  <input type="number" min="0" max={subtotal} step="0.01" disabled={ajusteTipo === 'ninguno'} value={ajusteTipo === 'ninguno' ? 0 : ajusteMonto} onChange={(event) => setAjusteMonto(Math.max(0, Number(event.target.value || 0)))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right font-bold text-amber-300 outline-none focus:border-amber-500 disabled:opacity-40" />
                </label>
              </div>
              {ajusteTipo !== 'ninguno' && (
                <label className="mt-3 block text-xs font-medium text-slate-400">Motivo obligatorio
                  <input type="text" value={ajusteMotivo} onChange={(event) => setAjusteMotivo(event.target.value)} placeholder="Ej.: cortesía autorizada por la administradora" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-amber-500" />
                </label>
              )}
            </section>

            <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
              <h3 className="flex items-center gap-2 font-bold text-white"><BadgeDollarSign size={17} className="text-cyan-300" /> Resumen financiero</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase text-slate-500">Servicios</div><div className="mt-1 font-black text-white">{moneda(subtotal)}</div></div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase text-slate-500">Ajuste</div><div className="mt-1 font-black text-amber-300">− {moneda(ajusteAplicado)}</div></div>
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3"><div className="text-[10px] font-bold uppercase text-cyan-400">Total final</div><div className="mt-1 font-black text-white">{moneda(totalFinal)}</div></div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase text-slate-500">Pagado antes</div><div className="mt-1 font-black text-emerald-300">{moneda(pagadoAnterior)}</div></div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3"><div className="text-[10px] font-bold uppercase text-rose-300">Saldo actual</div><div className="mt-1 font-black text-white">{moneda(saldoAntesCobro)}</div></div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3"><div className="text-[10px] font-bold uppercase text-emerald-300">Saldo al cerrar</div><div className="mt-1 font-black text-white">{moneda(saldoFinal)}</div></div>
              </div>
              {creditoPrevio > 0 && <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-xs text-violet-200">El paciente tendrá un crédito a favor de <strong>{moneda(creditoPrevio)}</strong> porque ya pagó más que el total final.</div>}
            </section>
          </div>

          {saldoAntesCobro > 0 && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900/45 p-4">
              <div className="mb-4">
                <h3 className="flex items-center gap-2 font-bold text-white"><WalletCards size={17} className="text-violet-300" /> ¿Qué hacemos con el saldo?</h3>
                <p className="mt-1 text-xs text-slate-500">El estado del pago se calculará automáticamente.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['cobrar_ahora', 'Cobrar ahora', 'Registra un pago total o parcial antes de cerrar.'],
                  ['dejar_pendiente', 'Dejar pendiente', 'Finaliza la atención y conserva el saldo por cobrar.'],
                  ['agregar_plan', 'Agregar a plan de pagos', 'Mantiene el saldo financiado o lo prepara para crear un plan.']
                ].map(([valor, titulo, descripcion]) => (
                  <button key={valor} type="button" onClick={() => setAccionSaldo(valor)} className={`rounded-xl border p-3.5 text-left transition ${accionSaldo === valor ? 'border-cyan-500 bg-cyan-500/12 ring-2 ring-cyan-500/10' : 'border-slate-700 bg-slate-900/70 hover:border-slate-600'}`}>
                    <div className={`font-bold ${accionSaldo === valor ? 'text-cyan-300' : 'text-white'}`}>{titulo}</div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-500">{descripcion}</div>
                  </button>
                ))}
              </div>

              {accionSaldo === 'cobrar_ahora' && (
                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-medium text-slate-400">Monto a cobrar ahora
                      <input type="number" min="0.01" max={saldoAntesCobro} step="0.01" value={montoCobrar} onChange={(event) => setMontoCobrar(Math.max(0, Number(event.target.value || 0)))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right text-lg font-black text-cyan-300 outline-none focus:border-cyan-500" />
                    </label>
                    <label className="text-xs font-medium text-slate-400">Método de pago
                      <select value={metodoPago} onChange={(event) => setMetodoPago(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500">
                        {METODOS_PAGO.map((metodo) => <option key={metodo} value={metodo}>{metodo}</option>)}
                        <option value="Mixto">Pago mixto</option>
                      </select>
                    </label>
                  </div>

                  {metodoPago === 'Mixto' && (
                    <div className="mt-4 space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                      <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-bold text-violet-200">Detalle del pago mixto</div><div className="text-[11px] text-slate-500">Las partes deben sumar {moneda(cobroHoy)}.</div></div><button type="button" onClick={agregarPartePago} className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 px-2.5 py-1.5 text-xs font-bold text-violet-200 hover:bg-violet-500/10"><Plus size={13} /> Parte</button></div>
                      {pagosMixtos.map((parte) => (
                        <div key={parte.clave} className="grid grid-cols-[minmax(0,1fr)_140px_38px] gap-2">
                          <select value={parte.metodo} onChange={(event) => actualizarPagoMixto(parte.clave, 'metodo', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-violet-500">{METODOS_PAGO.map((metodo) => <option key={metodo}>{metodo}</option>)}</select>
                          <input type="number" min="0" step="0.01" value={parte.monto} onChange={(event) => actualizarPagoMixto(parte.clave, 'monto', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-right text-xs font-bold text-white outline-none focus:border-violet-500" />
                          <button type="button" onClick={() => eliminarPartePago(parte.clave)} disabled={pagosMixtos.length <= 2} className="flex items-center justify-center rounded-lg border border-slate-700 text-slate-500 hover:text-rose-300 disabled:opacity-25"><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <div className={`text-right text-xs font-bold ${Math.abs(totalMixto - cobroHoy) <= 0.009 ? 'text-emerald-300' : 'text-amber-300'}`}>Suma: {moneda(totalMixto)}</div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <label className="block font-medium text-slate-300">
            <span className="mb-1.5 flex items-center gap-2"><FileText size={15} className="text-emerald-400" /> Notas clínicas e indicaciones posteriores</span>
            <textarea value={notasFin} onChange={(event) => setNotasFin(event.target.value)} rows="4" placeholder="Ej.: evitar alimentos duros por 24 horas..." className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-white outline-none focus:border-emerald-500" />
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-5 py-2.5 font-medium text-slate-200 hover:bg-slate-600">Volver</button>
            <button type="submit" disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><Save size={18} /> {guardando ? 'Guardando cierre...' : 'Finalizar y guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
