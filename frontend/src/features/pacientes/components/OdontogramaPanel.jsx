import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardPlus, History, Info, Save, ShieldCheck, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../../../services/api';

const PERMANENTES = [
  ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'],
  ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']
];
const DECIDUAS = [
  ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'],
  ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75']
];

const HALLAZGOS = [
  ['ortodontico_fijo', 'Aparato ortodóntico fijo', '', 'variable'],
  ['ortodontico_removible', 'Aparato ortodóntico removible', '', 'variable'],
  ['corona', 'Corona', 'CM', 'variable'],
  ['corona_temporal', 'Corona temporal', 'CT', 'rojo'],
  ['defecto_esmalte', 'Defecto de desarrollo del esmalte', 'O', 'rojo'],
  ['diastema', 'Diastema', '', 'azul'],
  ['edentulo_total', 'Edéntulo total', '', 'azul'],
  ['espigo_munon', 'Espigo–muñón', '', 'variable'],
  ['fosas_fisuras', 'Fosas y fisuras profundas', 'FFP', 'azul'],
  ['fractura', 'Fractura dental', '', 'rojo'],
  ['fusion', 'Fusión', '', 'azul'],
  ['geminacion', 'Geminación', '', 'azul'],
  ['giroversion', 'Giroversión', '', 'azul'],
  ['impactacion', 'Impactación', 'I', 'azul'],
  ['implante', 'Implante dental', 'IMP', 'variable'],
  ['caries', 'Lesión de caries dental', 'CD', 'rojo'],
  ['macrodoncia', 'Macrodoncia', 'MAC', 'azul'],
  ['microdoncia', 'Microdoncia', 'MIC', 'azul'],
  ['movilidad', 'Movilidad patológica', 'M1', 'rojo'],
  ['ausente', 'Pieza dentaria ausente', 'DNE', 'azul'],
  ['clavija', 'Pieza dentaria en clavija', '', 'azul'],
  ['ectopica', 'Pieza dentaria ectópica', 'E', 'azul'],
  ['erupcion', 'Pieza dentaria en erupción', '', 'azul'],
  ['extruida', 'Pieza dentaria extruida', '', 'azul'],
  ['intruida', 'Pieza dentaria intruida', '', 'azul'],
  ['supernumeraria', 'Pieza dentaria supernumeraria', 'S', 'azul'],
  ['pulpotomia', 'Pulpotomía', 'PP', 'variable'],
  ['posicion_anormal', 'Posición anormal dentaria', 'M', 'azul'],
  ['protesis_fija', 'Prótesis dental parcial fija', '', 'variable'],
  ['protesis_completa', 'Prótesis dental completa', '', 'variable'],
  ['protesis_removible', 'Prótesis dental parcial removible', '', 'variable'],
  ['remanente_radicular', 'Remanente radicular', 'RR', 'rojo'],
  ['restauracion_definitiva', 'Restauración definitiva', 'R', 'variable'],
  ['restauracion_temporal', 'Restauración temporal', '', 'rojo'],
  ['sellante', 'Sellante', 'S', 'variable'],
  ['superficie_desgastada', 'Superficie desgastada', 'DES', 'rojo'],
  ['tratamiento_conducto', 'Tratamiento de conducto', 'TC', 'variable'],
  ['transposicion', 'Transposición dentaria', '', 'azul']
].map(([codigo, nombre, sigla, color]) => ({ codigo, nombre, sigla, color }));

const SUPERFICIES = ['vestibular', 'lingual', 'palatino', 'mesial', 'distal', 'oclusal', 'incisal', 'raiz'];
const MOTIVOS = {
  evaluacion_inicial: 'Evaluación inicial',
  inicio_plan: 'Inicio del plan de tratamiento',
  nuevo_hallazgo: 'Nuevos hallazgos clínicos',
  fin_plan: 'Culminación del plan de tratamiento',
  reingreso: 'Reingreso del paciente',
  solicitud_legal_personal: 'Solicitud judicial o personal'
};

const colorHex = (color) => color === 'rojo' ? '#ef4444' : '#2563eb';
const fechaLegible = (valor) => valor ? new Date(valor).toLocaleString('es-PE') : 'Sin fecha';

function Pieza({ numero, hallazgos, seleccionada, onClick }) {
  const colores = [...new Set(hallazgos.map((item) => item.color))];
  const principal = colores.includes('rojo') ? 'rojo' : colores[0] || null;
  return (
    <button type="button" onClick={onClick} className={`group flex min-w-[62px] flex-col items-center rounded-xl border px-1 py-2 transition ${seleccionada ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/30' : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'}`}>
      <svg viewBox="0 0 48 66" className="h-14 w-11" aria-label={`Pieza ${numero}`}>
        <path d="M14 4C7 9 7 20 10 31c2 8 3 27 8 30 4 2 4-16 6-19 2 3 3 21 7 19 5-3 6-22 8-30 3-11 3-22-4-27-5-4-16-4-21 0Z" fill={principal ? `${colorHex(principal)}22` : '#f8fafc'} stroke={principal ? colorHex(principal) : '#94a3b8'} strokeWidth="2" />
        {hallazgos.some((item) => item.superficies?.length) && <circle cx="24" cy="23" r="7" fill={colorHex(principal || 'azul')} opacity="0.85" />}
        {hallazgos.some((item) => item.codigo === 'ausente') && <path d="M9 10 39 55M39 10 9 55" stroke="#2563eb" strokeWidth="3" />}
        {hallazgos.some((item) => item.codigo === 'fractura') && <path d="m10 28 9-6 6 9 12-8" fill="none" stroke="#ef4444" strokeWidth="3" />}
      </svg>
      <span className="mt-1 text-sm font-black text-slate-200">{numero}</span>
      <span className="mt-1 flex min-h-4 max-w-[58px] flex-wrap justify-center gap-0.5">
        {hallazgos.slice(0, 3).map((item, indice) => <span key={`${item.codigo}-${indice}`} className="rounded px-1 text-[8px] font-black text-white" style={{ backgroundColor: colorHex(item.color) }}>{item.sigla || '●'}</span>)}
      </span>
    </button>
  );
}

function ArcoDental({ piezas, hallazgos, seleccion, onSeleccionar, etiqueta }) {
  return (
    <section>
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{etiqueta}</div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max justify-center gap-1.5">
          {piezas.map((numero) => <Pieza key={numero} numero={numero} hallazgos={hallazgos.filter((item) => item.piezas.includes(numero))} seleccionada={seleccion.includes(numero)} onClick={() => onSeleccionar(numero)} />)}
        </div>
      </div>
    </section>
  );
}

const formularioInicial = (hallazgo = HALLAZGOS[0]) => ({
  codigo: hallazgo.codigo,
  sigla: hallazgo.sigla,
  color: hallazgo.color === 'variable' ? 'azul' : hallazgo.color,
  superficies: [],
  detalle: ''
});

export default function OdontogramaPanel({ paciente }) {
  const pacienteId = paciente?.id;
  const [registros, setRegistros] = useState([]);
  const [registroVisible, setRegistroVisible] = useState(null);
  const [editando, setEditando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [denticion, setDenticion] = useState('permanente');
  const [motivo, setMotivo] = useState('evaluacion_inicial');
  const [seleccion, setSeleccion] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [form, setForm] = useState(formularioInicial());
  const [especificaciones, setEspecificaciones] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const cargar = useCallback(async () => {
    if (!pacienteId) return;
    setCargando(true);
    try {
      const datos = await api.getOdontogramas(pacienteId);
      setRegistros(datos || []);
      setRegistroVisible(datos?.[0] || null);
      if (!datos?.length) setEditando(true);
    } catch (error) {
      Swal.fire({ title: 'No se pudo cargar el odontograma', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    } finally {
      setCargando(false);
    }
  }, [pacienteId]);

  useEffect(() => { void cargar(); }, [cargar]);

  const hallazgosMostrados = editando ? hallazgos : (registroVisible?.hallazgos || []);
  const tipoActual = HALLAZGOS.find((item) => item.codigo === form.codigo) || HALLAZGOS[0];
  const resumen = hallazgosMostrados.reduce((acc, item) => {
    acc[item.color] = (acc[item.color] || 0) + 1;
    return acc;
  }, {});

  const cambiarTipo = (codigo) => {
    const hallazgo = HALLAZGOS.find((item) => item.codigo === codigo) || HALLAZGOS[0];
    setForm(formularioInicial(hallazgo));
  };
  const seleccionarPieza = (numero) => {
    if (!editando) return;
    setSeleccion((actual) => actual.includes(numero) ? actual.filter((item) => item !== numero) : [...actual, numero]);
  };
  const alternarSuperficie = (superficie) => setForm((actual) => ({
    ...actual,
    superficies: actual.superficies.includes(superficie)
      ? actual.superficies.filter((item) => item !== superficie)
      : [...actual.superficies, superficie]
  }));
  const agregarHallazgo = () => {
    if (!seleccion.length) return Swal.fire({ title: 'Selecciona una o más piezas', icon: 'info', background: '#1e293b', color: '#fff' });
    setHallazgos((actuales) => [...actuales, {
      codigo: tipoActual.codigo,
      nombre: tipoActual.nombre,
      piezas: [...seleccion],
      sigla: form.sigla.trim(),
      color: tipoActual.color === 'variable' ? form.color : tipoActual.color,
      superficies: form.superficies,
      detalle: form.detalle.trim()
    }]);
    setSeleccion([]);
    setForm(formularioInicial(tipoActual));
  };
  const nuevoRegistro = () => {
    const base = registroVisible || registros[0];
    setDenticion(base?.denticion || 'permanente');
    setHallazgos((base?.hallazgos || []).map((item) => ({ ...item, piezas: [...item.piezas], superficies: [...(item.superficies || [])] })));
    setEspecificaciones(base?.especificaciones || '');
    setObservaciones('');
    setMotivo(registros.length ? 'nuevo_hallazgo' : 'evaluacion_inicial');
    setSeleccion([]);
    setEditando(true);
  };
  const guardar = async () => {
    const confirmacion = await Swal.fire({
      title: 'Guardar versión inalterable',
      text: 'Después de guardarla no podrá editarse ni eliminarse. Los cambios futuros se registrarán en una nueva versión.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Guardar odontograma',
      cancelButtonText: 'Seguir revisando',
      background: '#1e293b',
      color: '#fff'
    });
    if (!confirmacion.isConfirmed) return;
    try {
      setGuardando(true);
      await api.crearOdontograma({ pacienteId, motivo, denticion, hallazgos, especificaciones, observaciones });
      setEditando(false);
      await cargar();
      Swal.fire({ title: 'Odontograma guardado', text: 'La versión clínica quedó protegida en el historial.', icon: 'success', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo guardar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="py-16 text-center text-slate-500">Cargando odontograma…</div>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-cyan-400" size={20} /><div><h3 className="font-black text-white">Odontograma clínico · NTS 188-MINSA/DGIESP-2022</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">Registra hallazgos observados, no tratamientos por realizar. Sistema FDI de dos dígitos; azul = buen estado/no patológico y rojo = mal estado, temporal o patológico.</p></div></div>
        </section>
        <section className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-center text-xs"><div className="rounded-xl bg-blue-500/10 p-2"><b className="block text-xl text-blue-400">{resumen.azul || 0}</b><span className="text-slate-400">Azules</span></div><div className="rounded-xl bg-red-500/10 p-2"><b className="block text-xl text-red-400">{resumen.rojo || 0}</b><span className="text-slate-400">Rojos</span></div></section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {registros.map((registro, indice) => <button key={registro.id} type="button" disabled={editando} onClick={() => { setRegistroVisible(registro); setDenticion(registro.denticion); }} className={`rounded-xl border px-3 py-2 text-xs font-bold ${registroVisible?.id === registro.id && !editando ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-400'}`}>v{registros.length - indice} · {fechaLegible(registro.creadoEn)}</button>)}
        </div>
        {!editando && <button type="button" onClick={nuevoRegistro} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white"><ClipboardPlus size={16} />Nuevo odontograma</button>}
      </div>

      {editando && <div className="grid gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 md:grid-cols-3"><label className="text-xs font-bold text-slate-400">Motivo<select value={motivo} onChange={(event) => setMotivo(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white">{Object.entries(MOTIVOS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select></label><label className="text-xs font-bold text-slate-400">Dentición<select value={denticion} onChange={(event) => setDenticion(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"><option value="permanente">Permanente</option><option value="decidua">Decidua</option><option value="mixta">Mixta</option></select></label><div className="flex items-end"><div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-[11px] text-amber-200"><Info size={14} className="mr-1 inline" />Selecciona una o varias piezas y luego agrega el hallazgo.</div></div></div>}

      <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
        {(denticion === 'permanente' || denticion === 'mixta') && <><ArcoDental piezas={PERMANENTES[0]} hallazgos={hallazgosMostrados} seleccion={seleccion} onSeleccionar={seleccionarPieza} etiqueta="Dentición permanente · maxilar superior" /><ArcoDental piezas={PERMANENTES[1]} hallazgos={hallazgosMostrados} seleccion={seleccion} onSeleccionar={seleccionarPieza} etiqueta="Dentición permanente · mandíbula" /></>}
        {(denticion === 'decidua' || denticion === 'mixta') && <div className="space-y-4 border-t border-slate-700 pt-4"><ArcoDental piezas={DECIDUAS[0]} hallazgos={hallazgosMostrados} seleccion={seleccion} onSeleccionar={seleccionarPieza} etiqueta="Dentición decidua · maxilar superior" /><ArcoDental piezas={DECIDUAS[1]} hallazgos={hallazgosMostrados} seleccion={seleccion} onSeleccionar={seleccionarPieza} etiqueta="Dentición decidua · mandíbula" /></div>}
      </section>

      {editando && <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><h3 className="mb-4 font-black text-white">Agregar hallazgo a {seleccion.length ? `pieza(s) ${seleccion.join(', ')}` : 'las piezas seleccionadas'}</h3><div className="grid gap-3 lg:grid-cols-4"><label className="text-xs font-bold text-slate-400 lg:col-span-2">Hallazgo NTS<select value={form.codigo} onChange={(event) => cambiarTipo(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white">{HALLAZGOS.map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}</select></label><label className="text-xs font-bold text-slate-400">Sigla<input value={form.sigla} onChange={(event) => setForm({ ...form, sigla: event.target.value.toUpperCase() })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" placeholder="Según hallazgo" /></label><label className="text-xs font-bold text-slate-400">Color<select disabled={tipoActual.color !== 'variable'} value={tipoActual.color === 'variable' ? form.color : tipoActual.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white disabled:opacity-60"><option value="azul">Azul · buen estado</option><option value="rojo">Rojo · patológico/temporal/mal estado</option></select></label></div><div className="mt-3"><div className="mb-2 text-xs font-bold text-slate-400">Superficies comprometidas (si corresponde)</div><div className="flex flex-wrap gap-2">{SUPERFICIES.map((superficie) => <button key={superficie} type="button" onClick={() => alternarSuperficie(superficie)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold capitalize ${form.superficies.includes(superficie) ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-slate-700 text-slate-500'}`}>{superficie}</button>)}</div></div><div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><input value={form.detalle} onChange={(event) => setForm({ ...form, detalle: event.target.value })} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" placeholder="Detalle clínico adicional (opcional)" /><button type="button" onClick={agregarHallazgo} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-black text-white">Agregar hallazgo</button></div></section>}

      <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-black text-white"><History size={17} className="text-cyan-400" />Hallazgos de esta versión</h3><span className="text-xs text-slate-500">{hallazgosMostrados.length} registro(s)</span></div><div className="space-y-2">{hallazgosMostrados.length ? hallazgosMostrados.map((item, indice) => <div key={`${item.codigo}-${indice}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div><div className="flex flex-wrap items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorHex(item.color) }} /><b className="text-sm text-white">{item.nombre}</b>{item.sigla && <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] font-black text-slate-300">{item.sigla}</span>}</div><div className="mt-1 text-xs text-slate-400">Pieza(s): {item.piezas.join(', ')}{item.superficies?.length ? ` · ${item.superficies.join(', ')}` : ''}</div>{item.detalle && <div className="mt-1 text-xs text-slate-500">{item.detalle}</div>}</div>{editando && <button type="button" onClick={() => setHallazgos((actuales) => actuales.filter((_, posicion) => posicion !== indice))} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 size={15} /></button>}</div>) : <div className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-slate-500">Sin hallazgos clínicos registrados.</div>}</div></section>

      <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-slate-400">Especificaciones<textarea readOnly={!editando} rows="3" value={editando ? especificaciones : (registroVisible?.especificaciones || '')} onChange={(event) => setEspecificaciones(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white read-only:opacity-70" placeholder="Características adicionales por falta de espacio…" /></label><label className="text-xs font-bold text-slate-400">Observaciones<textarea readOnly={!editando} rows="3" value={editando ? observaciones : (registroVisible?.observaciones || '')} onChange={(event) => setObservaciones(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white read-only:opacity-70" placeholder="Hallazgos no contemplados en la nomenclatura…" /></label></div>

      {editando ? <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={!registros.length} onClick={() => { setEditando(false); setSeleccion([]); }} className="rounded-xl border border-slate-600 px-4 py-2.5 text-xs font-bold text-slate-300 disabled:opacity-40">Cancelar borrador</button><button type="button" disabled={guardando} onClick={guardar} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50"><Save size={16} />{guardando ? 'Guardando…' : 'Guardar versión inalterable'}</button></div> : registroVisible && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} />Registrado por {registroVisible.profesionalNombre} · {fechaLegible(registroVisible.creadoEn)}</span><span>{MOTIVOS[registroVisible.motivo] || registroVisible.motivo}</span></div>}
    </div>
  );
}
