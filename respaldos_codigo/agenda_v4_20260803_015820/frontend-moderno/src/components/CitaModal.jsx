import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Layers,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  X
} from 'lucide-react';

const PROCEDIMIENTOS = [
  'Consulta de evaluación',
  'Limpieza dental',
  'Empaste / Resina',
  'Endodoncia (canal)',
  'Extracción simple',
  'Extracción muela juicio',
  'Corona dental',
  'Implante dental',
  'Blanqueamiento',
  'Ortodoncia — colocación',
  'Ortodoncia — control',
  'Prótesis dental',
  'Rayos X',
  'Cirugía oral'
];

const obtenerFechaLocal = () => {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const crearServicio = (nombre = 'Consulta de evaluación', costo = 0) => ({
  clave: `${Date.now()}-${Math.random()}`,
  seleccion: PROCEDIMIENTOS.includes(nombre) ? nombre : 'Otro',
  nombreOtro: PROCEDIMIENTOS.includes(nombre) ? '' : nombre,
  costo: Number(costo || 0)
});

const serviciosIniciales = (citaEditar) => {
  if (Array.isArray(citaEditar?.servicios) && citaEditar.servicios.length) {
    return citaEditar.servicios.map((servicio) =>
      crearServicio(servicio.nombre, servicio.costo)
    );
  }
  return [
    crearServicio(
      citaEditar?.procedimiento || 'Consulta de evaluación',
      citaEditar?.costo || 0
    )
  ];
};

const crearEstadoInicial = (citaEditar, pagoEditar, pacientes) => ({
  pacienteId: citaEditar?.pacienteId ?? pacientes[0]?.id ?? '',
  fecha: citaEditar?.fecha || obtenerFechaLocal(),
  hora: citaEditar?.hora || '09:00',
  servicios: serviciosIniciales(citaEditar),
  tipoPago: citaEditar?.tipoPago || 'contado',
  montoPagado: pagoEditar?.cobrado ?? 0,
  metodoPago:
    pagoEditar?.metodo && !['Pendiente', '—'].includes(pagoEditar.metodo)
      ? pagoEditar.metodo
      : 'Efectivo',
  estado: citaEditar?.estado || 'pendiente',
  sesionNum: citaEditar?.sesionNum ?? 1,
  totalSesiones: citaEditar?.totalSesiones ?? 1,
  notas: citaEditar?.notas || ''
});

export default function CitaModal({
  isOpen,
  onClose,
  onSave,
  citaEditar,
  pagoEditar,
  pacientes = []
}) {
  const [formData, setFormData] = useState(() =>
    crearEstadoInicial(citaEditar, pagoEditar, pacientes)
  );
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(crearEstadoInicial(citaEditar, pagoEditar, pacientes));
    setBusquedaPaciente('');
    setErrorFormulario('');
    setGuardando(false);
  }, [isOpen, citaEditar, pagoEditar, pacientes]);

  const pacientesFiltrados = useMemo(() => {
    const terminos = normalizar(busquedaPaciente).split(/\s+/).filter(Boolean);
    if (!terminos.length) return pacientes;
    return pacientes.filter((paciente) => {
      const texto = normalizar([
        paciente.nombre,
        paciente.cedula,
        paciente.codigo_ficha,
        paciente.telefono,
        paciente.correo
      ].join(' '));
      return terminos.every((termino) => texto.includes(termino));
    });
  }, [busquedaPaciente, pacientes]);

  const costoServicios = useMemo(
    () => formData.servicios.reduce(
      (total, servicio) => total + Math.max(0, Number(servicio.costo) || 0),
      0
    ),
    [formData.servicios]
  );

  if (!isOpen) return null;

  const sinCosto = ['cortesia', 'sesion'].includes(formData.tipoPago);
  const costoNumerico = sinCosto ? 0 : costoServicios;
  let cobradoPreview = Math.max(0, Number(formData.montoPagado) || 0);
  if (formData.tipoPago === 'completo') cobradoPreview = costoNumerico;
  if (['contado', 'cortesia', 'sesion'].includes(formData.tipoPago)) cobradoPreview = 0;
  const saldoPreview = Math.max(0, costoNumerico - cobradoPreview);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setErrorFormulario('');
    setFormData((prev) => {
      const siguiente = { ...prev, [name]: value };
      if (name === 'tipoPago') {
        if (value === 'completo') siguiente.montoPagado = costoServicios;
        if (['contado', 'cortesia', 'sesion'].includes(value)) siguiente.montoPagado = 0;
      }
      return siguiente;
    });
  };

  const actualizarServicio = (clave, campo, valor) => {
    setErrorFormulario('');
    setFormData((prev) => ({
      ...prev,
      servicios: prev.servicios.map((servicio) =>
        servicio.clave === clave ? { ...servicio, [campo]: valor } : servicio
      )
    }));
  };

  const agregarServicio = () => {
    setFormData((prev) => ({
      ...prev,
      servicios: [...prev.servicios, crearServicio('Limpieza dental', 0)]
    }));
  };

  const quitarServicio = (clave) => {
    setFormData((prev) => ({
      ...prev,
      servicios: prev.servicios.length <= 1
        ? prev.servicios
        : prev.servicios.filter((servicio) => servicio.clave !== clave)
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const pacienteId = Number.parseInt(formData.pacienteId, 10);
    let montoPagado = Math.max(0, Number(formData.montoPagado) || 0);

    const servicios = formData.servicios.map((servicio) => ({
      nombre: servicio.seleccion === 'Otro'
        ? servicio.nombreOtro.trim()
        : servicio.seleccion.trim(),
      costo: sinCosto ? 0 : Math.max(0, Number(servicio.costo) || 0)
    })).filter((servicio) => servicio.nombre);

    if (!pacienteId) return setErrorFormulario('Debes seleccionar un paciente.');
    if (!formData.fecha || !formData.hora) return setErrorFormulario('Debes indicar fecha y hora.');
    if (!servicios.length) return setErrorFormulario('Debes agregar por lo menos un servicio.');
    if (servicios.some((servicio) => !servicio.nombre)) return setErrorFormulario('Todos los servicios deben tener un nombre.');

    if (formData.tipoPago === 'contado') montoPagado = 0;
    if (formData.tipoPago === 'completo') montoPagado = costoNumerico;
    if (sinCosto) montoPagado = 0;

    if (montoPagado > costoNumerico) return setErrorFormulario('El monto pagado no puede superar el costo total.');
    if (formData.tipoPago === 'anticipo' && montoPagado <= 0) return setErrorFormulario('Debes ingresar el anticipo.');
    if (formData.tipoPago === 'anticipo' && montoPagado >= costoNumerico) return setErrorFormulario('El anticipo debe ser menor al total.');
    if (formData.tipoPago === 'cuotas' && costoNumerico <= 0) return setErrorFormulario('Una atención en cuotas debe tener costo.');

    const sesionNum = Math.max(1, Number.parseInt(formData.sesionNum, 10) || 1);
    const totalSesiones = Math.max(1, Number.parseInt(formData.totalSesiones, 10) || 1);
    if (sesionNum > totalSesiones) return setErrorFormulario('La sesión actual no puede superar el total.');

    const procedimiento = servicios.map((servicio) => servicio.nombre).join(' + ');
    const payload = {
      pacienteId,
      planId: citaEditar?.planId ?? null,
      citaBaseId: citaEditar?.citaBaseId ?? null,
      fecha: formData.fecha,
      hora: formData.hora,
      procedimiento,
      servicios,
      costo: costoNumerico,
      tipoPago: formData.tipoPago,
      montoPagado,
      metodoPago: montoPagado > 0 ? formData.metodoPago : 'Pendiente',
      estado: formData.estado,
      sesionNum,
      totalSesiones,
      notas: formData.notas.trim()
    };

    try {
      setGuardando(true);
      await onSave(payload, citaEditar?.id);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-cyan-400">
              <Calendar size={20} /> {citaEditar?.id ? 'Editar atención programada' : 'Programar nueva atención'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Puedes registrar uno o varios servicios en la misma atención.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-6 text-sm">
          {errorFormulario && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">{errorFormulario}</div>}

          <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <label className="mb-2 flex items-center gap-1.5 font-medium text-slate-300"><User size={15} className="text-cyan-400" /> Paciente *</label>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="search" value={busquedaPaciente} onChange={(e) => setBusquedaPaciente(e.target.value)} placeholder="Buscar por nombre, DNI, ficha o teléfono..." className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-white outline-none focus:border-cyan-500" />
            </div>
            <select name="pacienteId" required value={formData.pacienteId} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-medium text-white outline-none focus:border-cyan-500">
              <option value="">-- Selecciona un paciente --</option>
              {pacientesFiltrados.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.codigo_ficha ? `[${paciente.codigo_ficha}] ` : ''}{paciente.nombre}{paciente.cedula ? ` · DNI ${paciente.cedula}` : ''}</option>)}
            </select>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Calendar size={15} className="text-cyan-400" />Fecha</span><input type="date" name="fecha" required value={formData.fecha} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Clock size={15} className="text-cyan-400" />Hora</span><input type="time" name="hora" required value={formData.hora} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-semibold text-cyan-300 outline-none focus:border-cyan-500" /></label>
          </div>

          <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="flex items-center gap-2 font-bold text-white"><FileText size={17} className="text-cyan-400" />Servicios de la atención</h3><p className="mt-0.5 text-xs text-slate-500">Agrega todos los procedimientos que se realizarán.</p></div>
              <button type="button" onClick={agregarServicio} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500"><Plus size={15} />Agregar servicio</button>
            </div>
            <div className="space-y-3">
              {formData.servicios.map((servicio, indice) => (
                <div key={servicio.clave} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Servicio {indice + 1}</span><button type="button" disabled={formData.servicios.length === 1} onClick={() => quitarServicio(servicio.clave)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"><Trash2 size={15} /></button></div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <div>
                      <select value={servicio.seleccion} onChange={(e) => actualizarServicio(servicio.clave, 'seleccion', e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500">
                        {PROCEDIMIENTOS.map((procedimiento) => <option key={procedimiento} value={procedimiento}>{procedimiento}</option>)}<option value="Otro">Otro servicio</option>
                      </select>
                      {servicio.seleccion === 'Otro' && <input type="text" value={servicio.nombreOtro} onChange={(e) => actualizarServicio(servicio.clave, 'nombreOtro', e.target.value)} placeholder="Nombre del servicio..." className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500" />}
                    </div>
                    <label className="text-xs font-medium text-slate-400">Costo (S/.)<input type="number" min="0" step="0.01" disabled={sinCosto} value={sinCosto ? 0 : servicio.costo} onChange={(e) => actualizarServicio(servicio.clave, 'costo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right font-bold text-white outline-none focus:border-cyan-500 disabled:opacity-50" /></label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"><span className="text-sm font-semibold text-slate-300">Total de servicios</span><span className="text-xl font-bold text-cyan-300">S/. {costoNumerico.toFixed(2)}</span></div>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><CreditCard size={15} className="text-cyan-400" />Modalidad de pago</span><select name="tipoPago" value={formData.tipoPago} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"><option value="contado">Pagar después / al finalizar</option><option value="completo">Pagado completo hoy</option><option value="anticipo">Con anticipo</option><option value="cuotas">En cuotas</option><option value="cortesia">Cortesía / sin costo</option>{(citaEditar?.citaBaseId || formData.tipoPago === 'sesion') && <option value="sesion">Sesión incluida en plan</option>}</select></label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 block">Estado</span><select name="estado" value={formData.estado} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"><option value="pendiente">Programado</option><option value="confirmada">Confirmado</option><option value="en_espera">En espera</option><option value="en_atencion">En atención</option><option value="completada">Finalizado</option><option value="no_asistio">No asistió</option><option value="cancelada">Cancelado</option></select></label>
          </div>

          {['completo', 'anticipo', 'cuotas'].includes(formData.tipoPago) && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="font-medium text-slate-300">Monto pagado hoy<input type="number" min="0" max={costoNumerico} step="0.01" name="montoPagado" value={formData.tipoPago === 'completo' ? costoNumerico : formData.montoPagado} disabled={formData.tipoPago === 'completo'} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 disabled:opacity-60" /></label><label className="font-medium text-slate-300">Método de pago<select name="metodoPago" value={formData.metodoPago} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"><option>Efectivo</option><option>Yape</option><option>Plin</option><option value="Transferencia">Transferencia bancaria</option><option>Tarjeta</option></select></label></div>}

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-center"><div><div className="text-[11px] uppercase text-slate-500">Total</div><div className="font-bold text-white">S/. {costoNumerico.toFixed(2)}</div></div><div><div className="text-[11px] uppercase text-slate-500">Cobrado</div><div className="font-bold text-emerald-400">S/. {Math.min(cobradoPreview, costoNumerico).toFixed(2)}</div></div><div><div className="text-[11px] uppercase text-slate-500">Saldo</div><div className="font-bold text-rose-400">S/. {saldoPreview.toFixed(2)}</div></div></div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Layers size={15} className="text-cyan-400" />Sesión actual</span><input type="number" min="1" name="sesionNum" value={formData.sesionNum} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label><label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Layers size={15} className="text-cyan-400" />Total de sesiones</span><input type="number" min="1" name="totalSesiones" value={formData.totalSesiones} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label></div>

          <label className="font-medium text-slate-300">Notas o indicaciones<textarea name="notas" value={formData.notas} onChange={handleChange} rows="3" placeholder="Observaciones clínicas o indicaciones..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label>

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4"><button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-5 py-2.5 font-medium text-slate-200 hover:bg-slate-600">Cancelar</button><button type="submit" disabled={guardando} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"><Save size={18} />{guardando ? 'Guardando...' : citaEditar?.id ? 'Guardar cambios' : 'Programar atención'}</button></div>
        </form>
      </div>
    </div>
  );
}
