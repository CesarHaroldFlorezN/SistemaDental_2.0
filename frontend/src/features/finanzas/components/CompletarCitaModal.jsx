import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Gift,
  ListPlus,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X
} from 'lucide-react';
import {
  buscarServicioCatalogo,
  normalizarTextoCatalogo,
  serviciosCatalogoDisponibles
} from '../../../shared/utils/catalogo';

const METODOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta'];
const crearClave = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const moneda = (valor) => `S/. ${Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const serviciosIniciales = (cita, catalogo) => {
  const base = Array.isArray(cita?.servicios) && cita.servicios.length
    ? cita.servicios
    : [{ nombre: cita?.procedimiento || 'Consulta de evaluación', costo: cita?.costo || 0 }];
  return base.map((servicio) => {
    const catalogado = buscarServicioCatalogo(catalogo, servicio);
    return {
      clave: crearClave(),
      servicioId: catalogado?.id || null,
      nombre: catalogado?.nombre || servicio?.nombre || 'Servicio dental',
      costo: Math.max(0, Number(servicio?.costo || 0)),
      realizado: true,
      origen: servicio?.origen || 'programado'
    };
  });
};

function SelectorServicio({ servicioId, value, catalogo, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(value || '');
  const contenedor = useRef(null);

  useEffect(() => setTexto(value || ''), [value]);
  useEffect(() => {
    const cerrar = (event) => {
      if (!contenedor.current?.contains(event.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const termino = normalizarTextoCatalogo(texto);
  const resultados = serviciosCatalogoDisponibles(catalogo, servicioId)
    .filter((item) =>
      normalizarTextoCatalogo(`${item.nombre} ${item.categoria}`).includes(termino)
    )
    .slice(0, 12);

  return (
    <div ref={contenedor} className="relative">
      <Search size={15} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" />
      <input
        value={texto}
        onFocus={() => setAbierto(true)}
        onChange={(event) => {
          setTexto(event.target.value);
          onChange({ servicioId: null, nombre: event.target.value });
          setAbierto(true);
        }}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-9 text-white outline-none focus:border-cyan-500"
        placeholder="Buscar o escribir servicio..."
      />
      <button type="button" onClick={() => setAbierto((actual) => !actual)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"><ChevronDown size={16} /></button>
      {abierto && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-1.5 shadow-2xl">
          {resultados.length ? resultados.map((item) => (
            <button key={item.id} type="button" onClick={() => { setTexto(item.nombre); onChange({ servicioId: item.id, nombre: item.nombre, precio: item.precio }); setAbierto(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-cyan-600/20 hover:text-white">
              <span><strong>{item.nombre}</strong><small className="ml-2 text-slate-500">{item.categoria}</small></span>{Number(servicioId) === Number(item.id) && <Check size={15} className="text-emerald-400" />}
            </button>
          )) : <div className="px-3 py-4 text-center text-xs text-slate-500">Usa el texto escrito como servicio personalizado.</div>}
        </div>
      )}
    </div>
  );
}

export default function CompletarCitaModalV8({
  isOpen,
  onClose,
  onSave,
  cita,
  pago,
  serviciosCatalogo = []
}) {
  const [servicios, setServicios] = useState([]);
  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [ajusteTipo, setAjusteTipo] = useState('descuento_autorizado');
  const [ajusteMonto, setAjusteMonto] = useState(0);
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [accionSaldo, setAccionSaldo] = useState('cobrar_ahora');
  const [montoCobrar, setMontoCobrar] = useState(0);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [pagosMixtos, setPagosMixtos] = useState([{ clave: crearClave(), metodo: 'Efectivo', monto: 0 }, { clave: crearClave(), metodo: 'Yape', monto: 0 }]);
  const [notasFin, setNotasFin] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen || !cita) return;
    const iniciales = serviciosIniciales(cita, serviciosCatalogo);
    const subtotalInicial = iniciales.reduce((suma, item) => suma + item.costo, 0);
    const pagado = Math.max(0, Number(pago?.cobrado || 0));
    const saldo = Math.max(0, subtotalInicial - pagado);
    setServicios(iniciales);
    setMostrarAjuste(false);
    setAjusteTipo('descuento_autorizado');
    setAjusteMonto(0);
    setAjusteMotivo('');
    setAccionSaldo(saldo > 0 ? 'cobrar_ahora' : 'dejar_pendiente');
    setMontoCobrar(saldo);
    setMetodoPago('Efectivo');
    setPagosMixtos([{ clave: crearClave(), metodo: 'Efectivo', monto: saldo }, { clave: crearClave(), metodo: 'Yape', monto: 0 }]);
    setNotasFin(cita?.notasFin || '');
    setError('');
    setGuardando(false);
  }, [isOpen, cita, pago, serviciosCatalogo]);

  const realizados = useMemo(() => servicios.filter((item) => item.realizado && item.nombre.trim()), [servicios]);
  const noRealizados = useMemo(() => servicios.filter((item) => !item.realizado && item.nombre.trim()), [servicios]);
  const subtotal = useMemo(() => realizados.reduce((suma, item) => suma + Math.max(0, Number(item.costo || 0)), 0), [realizados]);
  const ajusteAplicado = mostrarAjuste ? Math.min(subtotal, Math.max(0, Number(ajusteMonto || 0))) : 0;
  const totalFinal = Math.max(0, subtotal - ajusteAplicado);
  const pagadoAnterior = Math.max(0, Number(pago?.cobrado || 0));
  const saldoAntesCobro = Math.max(0, totalFinal - pagadoAnterior);
  const creditoPrevio = Math.max(0, pagadoAnterior - totalFinal);
  const cobroHoy = accionSaldo === 'cobrar_ahora' ? Math.max(0, Number(montoCobrar || 0)) : 0;
  const saldoFinal = Math.max(0, saldoAntesCobro - cobroHoy);
  const totalMixto = pagosMixtos.reduce((suma, item) => suma + Math.max(0, Number(item.monto || 0)), 0);

  useEffect(() => {
    if (!isOpen || accionSaldo !== 'cobrar_ahora') return;
    setMontoCobrar(saldoAntesCobro);
    setPagosMixtos((actuales) => actuales.map((item, indice) => ({ ...item, monto: indice === 0 ? saldoAntesCobro : 0 })));
  }, [saldoAntesCobro, accionSaldo, isOpen]);

  if (!isOpen || !cita) return null;

  const actualizarServicio = (clave, cambios) => setServicios((actuales) => actuales.map((item) => item.clave === clave ? { ...item, ...cambios } : item));
  const agregarServicio = () => setServicios((actuales) => [...actuales, { clave: crearClave(), servicioId: null, nombre: '', costo: 0, realizado: true, origen: 'adicional' }]);
  const eliminarServicio = (clave) => setServicios((actuales) => actuales.length > 1 ? actuales.filter((item) => item.clave !== clave) : actuales);

  const enviar = async (event) => {
    event.preventDefault();
    setError('');
    if (!realizados.length) return setError('Debe quedar al menos un servicio marcado como realizado.');
    if (realizados.some((item) => !item.nombre.trim())) return setError('Todos los servicios realizados deben tener un nombre.');
    if (ajusteAplicado > 0 && !ajusteMotivo.trim()) return setError('Indica el motivo del descuento o cortesia.');
    if (accionSaldo === 'cobrar_ahora') {
      if (saldoAntesCobro <= 0) return setError('Esta atencion no tiene saldo por cobrar.');
      if (cobroHoy <= 0 || cobroHoy > saldoAntesCobro) return setError(`El cobro debe ser mayor que cero y no superar ${moneda(saldoAntesCobro)}.`);
      if (metodoPago === 'Mixto' && Math.abs(totalMixto - cobroHoy) > 0.009) return setError(`El pago mixto debe sumar exactamente ${moneda(cobroHoy)}.`);
    }

    const payload = {
      citaId: cita.id,
      pacienteId: cita.pacienteId,
      citaBaseId: cita.citaBaseId || null,
      serviciosRealizados: realizados.map((item) => ({ servicioId: item.servicioId || null, nombre: item.nombre.trim(), costo: Number(item.costo || 0), origen: item.origen })),
      serviciosNoRealizados: noRealizados.map((item) => ({ servicioId: item.servicioId || null, nombre: item.nombre.trim(), costo: Number(item.costo || 0), origen: item.origen })),
      procedimiento: realizados.map((item) => item.nombre.trim()).join(' + '),
      subtotal,
      ajuste: { tipo: mostrarAjuste ? ajusteTipo : 'ninguno', monto: ajusteAplicado, motivo: mostrarAjuste ? ajusteMotivo.trim() : '' },
      totalFinal,
      pagadoAnterior,
      accionSaldo,
      cobroHoy,
      metodoPago: accionSaldo === 'cobrar_ahora' ? metodoPago : 'Pendiente',
      pagosMixtos: metodoPago === 'Mixto' ? pagosMixtos.filter((item) => Number(item.monto || 0) > 0).map((item) => ({ metodo: item.metodo, monto: Number(item.monto || 0) })) : [],
      notasFin: notasFin.trim()
    };

    try { setGuardando(true); await onSave(payload); } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4">
          <div><h2 className="flex items-center gap-2 text-xl font-black text-emerald-400"><CheckCircle2 size={21} />Finalizar atencion</h2><p className="mt-1 font-bold text-white">{cita.nombrePaciente || 'Paciente'}</p><p className="mt-0.5 text-xs text-slate-500">Confirma servicios, notas y cobro sin borrar pagos anteriores.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={20} /></button>
        </header>

        <form onSubmit={enviar} className="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5 p-5">
            {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}

            {cita.planId && (
              <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm text-violet-100">
                <strong>Sesión incluida en un plan de tratamiento.</strong>
                <p className="mt-1 text-xs text-slate-400">La sesión programada cuesta S/. 0.00 en esta atención. Su cuota se cobra desde el cronograma del plan; aquí solo se facturan servicios adicionales, por ejemplo una profilaxis.</p>
              </div>
            )}

            <section className="rounded-2xl border border-slate-700 bg-slate-900/45 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold text-white"><ReceiptText size={17} className="text-cyan-400" />Servicios realizados</h3><p className="mt-1 text-xs text-slate-500">Desmarca lo no realizado o agrega un servicio solicitado durante la consulta.</p></div><button type="button" onClick={agregarServicio} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3.5 py-2.5 text-xs font-bold text-white"><ListPlus size={16} />Agregar servicio</button></div>
              <div className="space-y-3">
                {servicios.map((item, indice) => (
                  <article key={item.clave} className={`rounded-xl border p-3.5 ${item.realizado ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/60 opacity-70'}`}>
                    <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_145px_42px] md:items-end">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-300"><input type="checkbox" checked={item.realizado} onChange={(e) => actualizarServicio(item.clave, { realizado: e.target.checked })} className="accent-emerald-500" />Realizado</label>
                      <label className="text-xs font-semibold text-slate-400">Servicio {indice + 1}<div className="mt-1.5"><SelectorServicio servicioId={item.servicioId} value={item.nombre} catalogo={serviciosCatalogo} onChange={(seleccion) => actualizarServicio(item.clave, { servicioId: seleccion.servicioId, nombre: seleccion.nombre, ...(seleccion.precio !== undefined ? { costo: Number(seleccion.precio || 0) } : {}) })} /></div></label>
                      <label className="text-xs font-semibold text-slate-400">Precio (S/.)<input type="number" data-money-input="true" min="0" step="0.01" value={item.costo} onChange={(e) => actualizarServicio(item.clave, { costo: Math.max(0, Number(e.target.value || 0)) })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right font-black text-white outline-none focus:border-cyan-500" /></label>
                      <button type="button" disabled={servicios.length <= 1} onClick={() => eliminarServicio(item.clave)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-500 hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-30"><Trash2 size={16} /></button>
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{item.origen === 'adicional' ? 'Agregado durante la atencion' : 'Programado previamente'}</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900/45 p-4">
              {!mostrarAjuste ? <button type="button" onClick={() => setMostrarAjuste(true)} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-300"><Gift size={16} />Aplicar descuento o cortesia</button> : <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-amber-300"><Gift size={17} />Descuento o ajuste</h3><button type="button" onClick={() => { setMostrarAjuste(false); setAjusteMonto(0); setAjusteMotivo(''); }} className="text-xs text-slate-400 hover:text-white">Quitar ajuste</button></div><div className="grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-slate-400">Tipo<select value={ajusteTipo} onChange={(e) => setAjusteTipo(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"><option value="descuento_autorizado">Descuento autorizado</option><option value="cortesia_profesional">Cortesia profesional</option><option value="promocion">Promocion</option><option value="garantia_retratamiento">Garantia / retratamiento</option><option value="otro">Otro ajuste</option></select></label><label className="text-xs font-semibold text-slate-400">Monto (S/.)<input type="number" data-money-input="true" min="0" max={subtotal} step="0.01" value={ajusteMonto} onChange={(e) => setAjusteMonto(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right font-black text-white" /></label><label className="text-xs font-semibold text-slate-400">Motivo<input value={ajusteMotivo} onChange={(e) => setAjusteMotivo(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" placeholder="Obligatorio" /></label></div></div>}
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900/45 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-white"><CircleDollarSign size={17} className="text-emerald-400" />Como quedara el saldo</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ['cobrar_ahora', 'Cobrar ahora', 'Registra un pago total o parcial.'],
                  ['dejar_pendiente', 'Dejar pendiente', 'Finaliza clinicamente y mantiene la deuda.'],
                  ['agregar_plan', 'Vincular a plan', 'El saldo queda para un cronograma de pagos.']
                ].map(([valor, titulo, descripcion]) => <button key={valor} type="button" onClick={() => setAccionSaldo(valor)} className={`rounded-xl border p-3 text-left ${accionSaldo === valor ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/60'}`}><div className="font-bold text-white">{titulo}</div><div className="mt-1 text-[11px] text-slate-500">{descripcion}</div></button>)}
              </div>
              {accionSaldo === 'cobrar_ahora' && saldoAntesCobro > 0 && <div className="mt-4 grid gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 md:grid-cols-2"><label className="text-xs font-semibold text-slate-400">Monto a cobrar ahora<input type="number" data-money-input="true" min="0.01" max={saldoAntesCobro} step="0.01" value={montoCobrar} onChange={(e) => setMontoCobrar(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right text-lg font-black text-emerald-300" /></label><label className="text-xs font-semibold text-slate-400">Metodo<select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white">{METODOS.map((m) => <option key={m}>{m}</option>)}<option>Mixto</option></select></label>{metodoPago === 'Mixto' && <div className="space-y-2 md:col-span-2">{pagosMixtos.map((parte) => <div key={parte.clave} className="grid grid-cols-[1fr_150px_36px] gap-2"><select value={parte.metodo} onChange={(e) => setPagosMixtos((actuales) => actuales.map((item) => item.clave === parte.clave ? { ...item, metodo: e.target.value } : item))} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white">{METODOS.map((m) => <option key={m}>{m}</option>)}</select><input type="number" data-money-input="true" min="0" step="0.01" value={parte.monto} onChange={(e) => setPagosMixtos((actuales) => actuales.map((item) => item.clave === parte.clave ? { ...item, monto: Number(e.target.value || 0) } : item))} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right font-bold text-white" /><button type="button" onClick={() => setPagosMixtos((actuales) => actuales.length > 2 ? actuales.filter((item) => item.clave !== parte.clave) : actuales)} className="text-rose-300"><Trash2 size={15} /></button></div>)}<button type="button" onClick={() => setPagosMixtos((actuales) => [...actuales, { clave: crearClave(), metodo: 'Efectivo', monto: 0 }])} className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300"><Plus size={14} />Agregar parte</button><div className={`text-right text-xs font-bold ${Math.abs(totalMixto - cobroHoy) < 0.009 ? 'text-emerald-300' : 'text-amber-300'}`}>Suma: {moneda(totalMixto)} / {moneda(cobroHoy)}</div></div>}</div>}
            </section>

            <label className="block rounded-2xl border border-slate-700 bg-slate-900/45 p-4 text-xs font-semibold text-slate-400"><span className="mb-2 flex items-center gap-2 font-bold text-white"><FileText size={16} className="text-cyan-400" />Notas clinicas e indicaciones</span><textarea rows="4" value={notasFin} onChange={(e) => setNotasFin(e.target.value)} className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-cyan-500" placeholder="Indicaciones, evolucion y observaciones..." /></label>
          </div>

          <aside className="border-t border-slate-700 bg-slate-950/45 p-5 xl:sticky xl:top-0 xl:max-h-[calc(96vh-78px)] xl:overflow-y-auto xl:border-l xl:border-t-0">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
              <div className="mb-4 flex items-center gap-2 border-b border-dashed border-slate-600 pb-4"><ReceiptText size={19} className="text-cyan-400" /><div><div className="text-xs font-black uppercase tracking-widest text-cyan-400">Preboleta</div><div className="font-black text-white">Resumen de la atencion</div></div></div>
              <div className="space-y-2.5">{realizados.map((item) => <div key={item.clave} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 flex-1 text-slate-300">{item.nombre}</span><span className="shrink-0 font-bold text-white">{moneda(item.costo)}</span></div>)}</div>
              <div className="my-4 border-t border-dashed border-slate-600" />
              <div className="space-y-2 text-sm"><div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{moneda(subtotal)}</span></div>{ajusteAplicado > 0 && <div className="flex justify-between text-amber-300"><span>Descuento / ajuste</span><span>-{moneda(ajusteAplicado)}</span></div>}<div className="flex justify-between border-t border-slate-700 pt-3 text-lg font-black text-white"><span>TOTAL</span><span>{moneda(totalFinal)}</span></div><div className="flex justify-between text-emerald-300"><span>Pagado anteriormente</span><span>{moneda(pagadoAnterior)}</span></div>{cobroHoy > 0 && <div className="flex justify-between text-cyan-300"><span>Pago recibido hoy</span><span>{moneda(cobroHoy)}</span></div>}<div className="flex justify-between border-t border-dashed border-slate-600 pt-3 text-lg font-black"><span className={saldoFinal > 0 ? 'text-rose-300' : 'text-emerald-300'}>{saldoFinal > 0 ? 'SALDO PENDIENTE' : 'PAGADO'}</span><span className={saldoFinal > 0 ? 'text-rose-300' : 'text-emerald-300'}>{moneda(saldoFinal)}</span></div>{creditoPrevio > 0 && <div className="flex justify-between text-violet-300"><span>Credito a favor</span><span>{moneda(creditoPrevio)}</span></div>}</div>
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-500">El pago anterior es de solo lectura. Para corregirlo se debe usar Anular pago o Registrar devolucion en la ficha del paciente.</div>
            </div>
            <div className="mt-4 flex flex-col gap-2"><button type="submit" disabled={guardando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-500 disabled:opacity-50"><CheckCircle2 size={18} />{guardando ? 'Guardando...' : 'Finalizar atencion'}</button><button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-600 px-5 py-3 font-bold text-slate-300">Volver</button></div>
          </aside>
        </form>
      </div>
    </div>
  );
}
