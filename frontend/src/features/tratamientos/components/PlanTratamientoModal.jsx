import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CreditCard,
  DollarSign,
  FolderKanban,
  Layers,
  Save,
  Search,
  User,
  UserCheck,
  X
} from 'lucide-react';

const ESPECIALIDADES_BASE = [
  'Endodoncia',
  'Ortodoncia',
  'Rehabilitación',
  'Implantología',
  'Periodoncia'
];

const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const etiquetaPaciente = (paciente) => {
  if (!paciente) return '';
  const ficha = paciente.codigo_ficha ? `[${paciente.codigo_ficha}] ` : '';
  const dni = paciente.cedula ? ` · DNI ${paciente.cedula}` : '';
  return `${ficha}${paciente.nombre || 'Paciente'}${dni}`;
};

const crearEstado = (plan, especialidades) => {
  const tipoGuardado = plan?.tipo || 'Endodoncia';
  const esEspecialidadConocida = especialidades.includes(tipoGuardado);

  return {
    pacienteId: plan?.pacienteId || '',
    casoClinicoId: plan?.casoClinicoId || '',
    nombre: plan?.nombre || '',
    tipo: esEspecialidadConocida ? tipoGuardado : 'Otro',
    tipoPersonalizado: esEspecialidadConocida ? '' : tipoGuardado,
    duracion: plan?.duracion || '3 meses',
    costo: plan?.costo ?? '',
    nSesiones: plan?.nSesiones || 3,
    descripcion: plan?.descripcion || '',
    estado: plan?.estado || 'activo',
    crearPlanPago: false
  };
};

export default function PlanTratamientoModal({
  isOpen,
  onClose,
  onSave,
  planEditar,
  pacientes = [],
  casosClinicos = [],
  serviciosCatalogo = []
}) {
  const especialidades = useMemo(
    () =>
      [
        ...new Set([
          ...ESPECIALIDADES_BASE,
          ...serviciosCatalogo
            .filter((servicio) => servicio.activo)
            .map((servicio) => servicio.categoria)
            .filter(Boolean)
        ])
      ].sort((a, b) => a.localeCompare(b, 'es')),
    [serviciosCatalogo]
  );
  const [formData, setFormData] = useState(() =>
    crearEstado(planEditar, especialidades)
  );
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [indiceSugerencia, setIndiceSugerencia] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const esEdicion = Boolean(planEditar?.id);

  useEffect(() => {
    if (!isOpen) return;
    const estado = crearEstado(planEditar, especialidades);
    setFormData(estado);
    setBusquedaPaciente(etiquetaPaciente(
      pacientes.find((paciente) => Number(paciente.id) === Number(estado.pacienteId))
    ));
    setMostrarSugerencias(false);
    setIndiceSugerencia(0);
    setGuardando(false);
  }, [isOpen, planEditar, pacientes, especialidades]);

  const pacienteSeleccionado = useMemo(
    () => pacientes.find(
      (paciente) => Number(paciente.id) === Number(formData.pacienteId)
    ) || null,
    [pacientes, formData.pacienteId]
  );

  const pacientesFiltrados = useMemo(() => {
    const terminos = normalizar(busquedaPaciente).split(/\s+/).filter(Boolean);
    return pacientes.filter((paciente) => {
      if (!terminos.length) return true;
      const texto = normalizar([
        paciente.codigo_ficha,
        paciente.nombre,
        paciente.cedula,
        paciente.telefono,
        paciente.correo
      ].join(' '));
      return terminos.every((termino) => texto.includes(termino));
    }).slice(0, 8);
  }, [busquedaPaciente, pacientes]);

  useEffect(() => {
    setIndiceSugerencia(0);
  }, [busquedaPaciente]);

  if (!isOpen) return null;

  const casosPaciente = casosClinicos.filter(
    (caso) => Number(caso.pacienteId) === Number(formData.pacienteId)
      && !caso.planId
      && !['resuelto', 'cerrado'].includes(caso.estado)
  );
  const cantidadSesiones = Math.max(1, Number.parseInt(formData.nSesiones, 10) || 1);
  const sesionesOriginales = Math.max(1, Number(planEditar?.nSesiones || 1));
  const sesionesAgregadas = Math.max(0, cantidadSesiones - sesionesOriginales);
  const tieneCronograma = Boolean(planEditar?.planPago);

  const seleccionarPaciente = (paciente) => {
    setFormData((prev) => ({
      ...prev,
      pacienteId: paciente.id,
      casoClinicoId: Number(prev.pacienteId) === Number(paciente.id)
        ? prev.casoClinicoId
        : ''
    }));
    setBusquedaPaciente(etiquetaPaciente(paciente));
    setMostrarSugerencias(false);
  };

  const handleBusquedaPaciente = (event) => {
    const valor = event.target.value;
    setBusquedaPaciente(valor);
    setMostrarSugerencias(true);
    if (!pacienteSeleccionado || valor !== etiquetaPaciente(pacienteSeleccionado)) {
      setFormData((prev) => ({
        ...prev,
        pacienteId: '',
        casoClinicoId: ''
      }));
    }
  };

  const handleTeclaPaciente = (event) => {
    if (!mostrarSugerencias || !pacientesFiltrados.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIndiceSugerencia((prev) => Math.min(prev + 1, pacientesFiltrados.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIndiceSugerencia((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      seleccionarPaciente(pacientesFiltrados[indiceSugerencia]);
    } else if (event.key === 'Escape') {
      setMostrarSugerencias(false);
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'pacienteId' ? { casoClinicoId: '' } : {})
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.pacienteId || !formData.nombre.trim()) return;
    const payload = {
      pacienteId: Number(formData.pacienteId),
      casoClinicoId: Number(formData.casoClinicoId) || null,
      nombre: formData.nombre.trim(),
      tipo: formData.tipo === 'Otro'
        ? formData.tipoPersonalizado.trim()
        : formData.tipo,
      duracion: formData.duracion,
      costo: Math.max(0, Number(formData.costo) || 0),
      nSesiones: cantidadSesiones,
      descripcion: formData.descripcion.trim(),
      estado: formData.estado
    };

    if (!payload.tipo) return;

    try {
      setGuardando(true);
      await onSave(payload, planEditar?.id, {
        abrirPlanPago: !esEdicion && formData.crearPlanPago && payload.costo > 0
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-purple-400"><FolderKanban size={20} />{esEdicion ? 'Editar plan de tratamiento' : 'Crear plan de tratamiento'}</h2>
            <p className="mt-1 text-xs text-slate-500">Se crearán desde ahora todas las sesiones y la deuda total del plan.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative font-medium text-slate-300">
              <span className="mb-1.5 flex items-center gap-1.5"><User size={15} className="text-purple-400" />Paciente *</span>
              {esEdicion ? (
                <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white opacity-80">
                  <UserCheck size={17} className="shrink-0 text-emerald-400" />
                  <span className="truncate">{etiquetaPaciente(pacienteSeleccionado) || 'Paciente no encontrado'}</span>
                </div>
              ) : (
                <>
                  <div className={`relative rounded-xl border bg-slate-900 transition ${mostrarSugerencias ? 'border-purple-500 ring-2 ring-purple-500/10' : 'border-slate-700'}`}>
                    <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      autoComplete="off"
                      required
                      value={busquedaPaciente}
                      onChange={handleBusquedaPaciente}
                      onFocus={() => setMostrarSugerencias(true)}
                      onBlur={() => window.setTimeout(() => setMostrarSugerencias(false), 150)}
                      onKeyDown={handleTeclaPaciente}
                      placeholder="Ficha, nombre, DNI, teléfono o correo..."
                      className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-11 text-white outline-none"
                    />
                    {pacienteSeleccionado
                      ? <UserCheck size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                      : <ChevronDown size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />}
                  </div>
                  {mostrarSugerencias && (
                    <div className="absolute left-0 right-0 top-[70px] z-30 max-h-72 overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-1.5 shadow-2xl">
                      {pacientesFiltrados.length ? pacientesFiltrados.map((paciente, indice) => (
                        <button
                          key={paciente.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => seleccionarPaciente(paciente)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${indice === indiceSugerencia ? 'bg-purple-600/25 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{paciente.nombre}</span>
                            <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                              <span className="font-semibold text-purple-300">Ficha {paciente.codigo_ficha || '—'}</span>
                              {paciente.cedula && <span>DNI {paciente.cedula}</span>}
                              {paciente.telefono && <span>{paciente.telefono}</span>}
                            </span>
                          </span>
                          {Number(formData.pacienteId) === Number(paciente.id) && <Check size={17} className="shrink-0 text-emerald-400" />}
                        </button>
                      )) : <div className="px-4 py-8 text-center text-xs text-slate-400">No se encontró un paciente con esos datos.</div>}
                    </div>
                  )}
                </>
              )}
            </div>
            <label className="font-medium text-slate-300">Caso diagnosticado
              <select name="casoClinicoId" disabled={esEdicion} value={formData.casoClinicoId} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500 disabled:opacity-60"><option value="">Crear un caso nuevo para este plan</option>{casosPaciente.map((caso) => <option key={caso.id} value={caso.id}>{caso.titulo}</option>)}</select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="font-medium text-slate-300">Nombre del plan *<input type="text" name="nombre" required value={formData.nombre} onChange={handleChange} placeholder="Ej.: Endodoncia pieza 26" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-semibold text-white outline-none focus:border-purple-500" /></label>
            <label className="font-medium text-slate-300">Especialidad / tipo
              <select name="tipo" value={formData.tipo} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500">{especialidades.map((especialidad) => <option key={especialidad}>{especialidad}</option>)}<option>Otro</option></select>
              {formData.tipo === 'Otro' && <input type="text" name="tipoPersonalizado" required value={formData.tipoPersonalizado} onChange={handleChange} placeholder="Escribe la especialidad o tipo" className="mt-2 w-full rounded-xl border border-purple-500/40 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-400" />}
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="font-medium text-slate-300">Duración estimada<select name="duracion" value={formData.duracion} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500"><option>1 mes</option><option>3 meses</option><option>6 meses</option><option>1 año</option><option>2 años</option></select></label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1"><DollarSign size={14} className="text-purple-400" />Costo total (S/.)</span><input type="number" min="0" step="0.01" name="costo" data-money-input="true" value={formData.costo} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-bold text-white outline-none focus:border-purple-500" /></label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1"><Layers size={14} className="text-purple-400" />Número de sesiones</span><input type="number" min="1" max="60" name="nSesiones" value={formData.nSesiones} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-semibold text-white outline-none focus:border-purple-500" /></label>
          </div>

          <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-300">Vista previa de sesiones</div>
            <div className="flex flex-wrap gap-2">{Array.from({ length: Math.min(cantidadSesiones, 20) }, (_, indice) => <span key={indice} className="flex h-9 min-w-9 items-center justify-center rounded-full border border-purple-400 bg-purple-100 px-2 text-xs font-black text-purple-950 shadow-sm">{indice + 1}</span>)}{cantidadSesiones > 20 && <span className="self-center text-xs text-slate-300">+ {cantidadSesiones - 20} más</span>}</div>
            <p className="mt-3 text-xs text-slate-400">Estas sesiones aparecerán inmediatamente como pendientes. Al agendarlas, el sistema seleccionará el siguiente número disponible y evitará superar el total.</p>
            {esEdicion && sesionesAgregadas > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100">
                Se agregarán {sesionesAgregadas} sesión(es). {tieneCronograma
                  ? `El plan de pagos pasará de ${sesionesOriginales} a ${cantidadSesiones} cuotas; las pagadas no cambiarán y el saldo se repartirá entre las pendientes.`
                  : 'Quedarán disponibles para agendar inmediatamente.'}
              </div>
            )}
            {esEdicion && tieneCronograma && cantidadSesiones < sesionesOriginales && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100">
                No se pueden reducir sesiones mientras existan cuotas vinculadas. Conserva al menos {sesionesOriginales}.
              </div>
            )}
          </div>

          <label className="block font-medium text-slate-300">Descripción, diagnóstico u objetivos<textarea name="descripcion" rows="3" value={formData.descripcion} onChange={handleChange} placeholder="Fases, objetivos clínicos e indicaciones..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-purple-500" /></label>

          {!esEdicion && Number(formData.costo) > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4">
              <input type="checkbox" name="crearPlanPago" checked={formData.crearPlanPago} onChange={handleChange} className="mt-1 h-4 w-4 accent-cyan-500" />
              <CreditCard size={18} className="mt-0.5 shrink-0 text-cyan-400" />
              <span><strong className="text-cyan-100">Crear también el cronograma de pagos</strong><span className="mt-1 block text-xs text-slate-400">Se abrirá con el paciente, el costo y {cantidadSesiones} cuotas —una por sesión— ya completados.</span></span>
            </label>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-5 py-2.5 font-medium text-slate-200 hover:bg-slate-600">Cancelar</button>
            <button type="submit" disabled={guardando || (esEdicion && tieneCronograma && cantidadSesiones < sesionesOriginales)} className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 font-semibold text-white hover:bg-purple-500 disabled:opacity-50"><Save size={18} />{guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear plan y sesiones'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
