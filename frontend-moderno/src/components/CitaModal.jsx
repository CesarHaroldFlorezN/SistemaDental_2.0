import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Layers,
  Plus,
  Save,
  Search,
  Timer,
  Trash2,
  User,
  UserCheck,
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

const DURACIONES_RAPIDAS = [15, 30, 45, 60, 90, 120];
const ESTADOS_QUE_OCUPAN_HORARIO = new Set([
  'pendiente',
  'confirmada',
  'en_espera',
  'en_atencion'
]);

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

const horaAMinutos = (hora) => {
  const [horas, minutos] = String(hora || '').split(':').map(Number);
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return null;
  return horas * 60 + minutos;
};

const minutosAHora = (total) => {
  const valor = Math.max(0, Math.min(1439, Number(total) || 0));
  return `${String(Math.floor(valor / 60)).padStart(2, '0')}:${String(valor % 60).padStart(2, '0')}`;
};

const sumarMinutos = (hora, minutos) => {
  const inicio = horaAMinutos(hora);
  if (inicio === null) return hora;
  return minutosAHora(inicio + Number(minutos || 0));
};

const calcularDuracion = (horaInicio, horaFin) => {
  const inicio = horaAMinutos(horaInicio);
  const fin = horaAMinutos(horaFin);
  if (inicio === null || fin === null) return 0;
  return fin - inicio;
};

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

const etiquetaPaciente = (paciente) => {
  if (!paciente) return '';
  const ficha = paciente.codigo_ficha ? `[${paciente.codigo_ficha}] ` : '';
  const dni = paciente.cedula ? ` · DNI ${paciente.cedula}` : '';
  return `${ficha}${paciente.nombre || 'Paciente'}${dni}`;
};

const obtenerHoraFinCita = (cita) => {
  if (cita?.horaFin) return cita.horaFin;
  return sumarMinutos(cita?.hora || '09:00', Number(cita?.duracionMinutos || 60));
};

const crearEstadoInicial = (citaEditar, pagoEditar, pacientes) => {
  const hora = citaEditar?.hora || '09:00';
  const duracionGuardada = Math.max(5, Number(citaEditar?.duracionMinutos || 60));
  const horaFin = citaEditar?.horaFin || sumarMinutos(hora, duracionGuardada);
  const duracionReal = calcularDuracion(hora, horaFin) || duracionGuardada;

  return {
    pacienteId: citaEditar?.pacienteId ?? '',
    fecha: citaEditar?.fecha || obtenerFechaLocal(),
    hora,
    horaFin,
    duracionMinutos: duracionReal,
    modoDuracion: DURACIONES_RAPIDAS.includes(duracionReal) ? String(duracionReal) : 'libre',
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
  };
};

export default function CitaModal({
  isOpen,
  onClose,
  onSave,
  citaEditar,
  pagoEditar,
  pacientes = [],
  citas = []
}) {
  const [formData, setFormData] = useState(() =>
    crearEstadoInicial(citaEditar, pagoEditar, pacientes)
  );
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [indiceSugerencia, setIndiceSugerencia] = useState(0);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const contenedorPacienteRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const estado = crearEstadoInicial(citaEditar, pagoEditar, pacientes);
    setFormData(estado);
    const seleccionado = pacientes.find((paciente) => Number(paciente.id) === Number(estado.pacienteId));
    setBusquedaPaciente(etiquetaPaciente(seleccionado));
    setMostrarSugerencias(false);
    setIndiceSugerencia(0);
    setErrorFormulario('');
    setGuardando(false);
  }, [isOpen, citaEditar, pagoEditar, pacientes]);

  const pacientesFiltrados = useMemo(() => {
    const terminos = normalizar(busquedaPaciente).split(/\s+/).filter(Boolean);
    const resultados = pacientes.filter((paciente) => {
      if (!terminos.length) return true;
      const texto = normalizar([
        paciente.codigo_ficha,
        paciente.nombre,
        paciente.cedula,
        paciente.telefono,
        paciente.correo
      ].join(' '));
      return terminos.every((termino) => texto.includes(termino));
    });
    return resultados.slice(0, 8);
  }, [busquedaPaciente, pacientes]);

  useEffect(() => {
    setIndiceSugerencia(0);
  }, [busquedaPaciente]);

  const pacienteSeleccionado = useMemo(
    () => pacientes.find((paciente) => Number(paciente.id) === Number(formData.pacienteId)) || null,
    [pacientes, formData.pacienteId]
  );

  const costoServicios = useMemo(
    () => formData.servicios.reduce(
      (total, servicio) => total + Math.max(0, Number(servicio.costo) || 0),
      0
    ),
    [formData.servicios]
  );

  const conflictoHorario = useMemo(() => {
    if (!ESTADOS_QUE_OCUPAN_HORARIO.has(formData.estado)) return null;
    const inicio = horaAMinutos(formData.hora);
    const fin = horaAMinutos(formData.horaFin);
    if (inicio === null || fin === null || fin <= inicio) return null;

    return citas.find((cita) => {
      if (Number(cita.id) === Number(citaEditar?.id)) return false;
      if (cita.fecha !== formData.fecha) return false;
      if (!ESTADOS_QUE_OCUPAN_HORARIO.has(cita.estado || 'pendiente')) return false;
      const inicioExistente = horaAMinutos(cita.hora);
      const finExistente = horaAMinutos(obtenerHoraFinCita(cita));
      if (inicioExistente === null || finExistente === null) return false;
      return inicio < finExistente && fin > inicioExistente;
    }) || null;
  }, [citas, citaEditar?.id, formData.estado, formData.fecha, formData.hora, formData.horaFin]);

  if (!isOpen) return null;

  const sinCosto = ['cortesia', 'sesion'].includes(formData.tipoPago);
  const costoNumerico = sinCosto ? 0 : costoServicios;
  let cobradoPreview = Math.max(0, Number(formData.montoPagado) || 0);
  if (formData.tipoPago === 'completo') cobradoPreview = costoNumerico;
  if (['contado', 'cortesia', 'sesion'].includes(formData.tipoPago)) cobradoPreview = 0;
  const saldoPreview = Math.max(0, costoNumerico - cobradoPreview);
  const duracionActual = calcularDuracion(formData.hora, formData.horaFin);

  const seleccionarPaciente = (paciente) => {
    setFormData((prev) => ({ ...prev, pacienteId: paciente.id }));
    setBusquedaPaciente(etiquetaPaciente(paciente));
    setMostrarSugerencias(false);
    setErrorFormulario('');
  };

  const handleBusquedaPaciente = (event) => {
    const valor = event.target.value;
    setBusquedaPaciente(valor);
    setMostrarSugerencias(true);
    if (!pacienteSeleccionado || valor !== etiquetaPaciente(pacienteSeleccionado)) {
      setFormData((prev) => ({ ...prev, pacienteId: '' }));
    }
    setErrorFormulario('');
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

  const cambiarHoraInicio = (value) => {
    setErrorFormulario('');
    setFormData((prev) => {
      const duracion = prev.modoDuracion === 'libre'
        ? Math.max(5, calcularDuracion(prev.hora, prev.horaFin) || prev.duracionMinutos || 60)
        : Number(prev.modoDuracion || 60);
      return {
        ...prev,
        hora: value,
        horaFin: sumarMinutos(value, duracion),
        duracionMinutos: duracion
      };
    });
  };

  const seleccionarDuracion = (valor) => {
    setErrorFormulario('');
    setFormData((prev) => {
      if (valor === 'libre') return { ...prev, modoDuracion: 'libre' };
      const duracion = Number(valor);
      return {
        ...prev,
        modoDuracion: String(duracion),
        duracionMinutos: duracion,
        horaFin: sumarMinutos(prev.hora, duracion)
      };
    });
  };

  const cambiarHoraFin = (value) => {
    setErrorFormulario('');
    setFormData((prev) => ({
      ...prev,
      horaFin: value,
      modoDuracion: 'libre',
      duracionMinutos: Math.max(0, calcularDuracion(prev.hora, value))
    }));
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

    if (!pacienteId) return setErrorFormulario('Selecciona un paciente de la lista de resultados.');
    if (!formData.fecha || !formData.hora || !formData.horaFin) return setErrorFormulario('Debes indicar fecha, hora de inicio y hora final.');
    if (duracionActual < 5) return setErrorFormulario('La hora final debe ser posterior a la hora de inicio.');
    if (duracionActual > 720) return setErrorFormulario('La cita no puede durar más de 12 horas.');
    if (conflictoHorario) {
      const pacienteConflicto = pacientes.find((paciente) => Number(paciente.id) === Number(conflictoHorario.pacienteId));
      return setErrorFormulario(`El horario se cruza con ${pacienteConflicto?.nombre || 'otra cita'} (${conflictoHorario.hora} → ${obtenerHoraFinCita(conflictoHorario)}).`);
    }
    if (!servicios.length) return setErrorFormulario('Debes agregar por lo menos un servicio.');

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
      horaFin: formData.horaFin,
      duracionMinutos: duracionActual,
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
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-cyan-400">
              <Calendar size={20} /> {citaEditar?.id ? 'Editar atención programada' : 'Programar nueva atención'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Paciente, horario, servicios y pago en un solo flujo.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-6 text-sm">
          {errorFormulario && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">{errorFormulario}</div>}

          <section ref={contenedorPacienteRef} className="relative rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
            <label className="mb-2 flex items-center gap-1.5 font-medium text-slate-300"><User size={15} className="text-cyan-400" /> Paciente *</label>
            <div className={`relative rounded-xl border bg-slate-900 transition ${mostrarSugerencias ? 'border-cyan-500 ring-2 ring-cyan-500/10' : 'border-slate-700'}`}>
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoComplete="off"
                value={busquedaPaciente}
                onChange={handleBusquedaPaciente}
                onFocus={() => setMostrarSugerencias(true)}
                onBlur={() => window.setTimeout(() => setMostrarSugerencias(false), 150)}
                onKeyDown={handleTeclaPaciente}
                placeholder="Escribe nombre, ficha, DNI, teléfono o correo..."
                className="w-full rounded-xl bg-transparent py-3 pl-10 pr-12 font-medium text-white outline-none"
              />
              {pacienteSeleccionado ? <UserCheck size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400" /> : <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />}
            </div>

            {mostrarSugerencias && (
              <div className="absolute left-4 right-4 top-[88px] z-30 max-h-72 overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-1.5 shadow-2xl">
                {pacientesFiltrados.length ? pacientesFiltrados.map((paciente, indice) => (
                  <button
                    key={paciente.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => seleccionarPaciente(paciente)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${indice === indiceSugerencia ? 'bg-cyan-600/20 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold">{paciente.nombre}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                        <span className="font-semibold text-cyan-400">Ficha {paciente.codigo_ficha || '—'}</span>
                        {paciente.cedula && <span>DNI {paciente.cedula}</span>}
                        {paciente.telefono && <span>{paciente.telefono}</span>}
                      </div>
                    </div>
                    {Number(formData.pacienteId) === Number(paciente.id) && <Check size={17} className="shrink-0 text-emerald-400" />}
                  </button>
                )) : <div className="px-4 py-8 text-center text-xs text-slate-500">No se encontró un paciente con esos datos.</div>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
            <div className="mb-3 flex items-center gap-2"><Clock size={17} className="text-cyan-400" /><div><h3 className="font-bold text-white">Fecha y rango de atención</h3><p className="text-xs text-slate-500">El sistema bloqueará automáticamente los horarios que se crucen.</p></div></div>
            <div className="grid gap-4 md:grid-cols-[1.15fr_1fr_auto_1fr] md:items-end">
              <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Calendar size={15} className="text-cyan-400" />Fecha</span><input type="date" name="fecha" required value={formData.fecha} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label>
              <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Clock size={15} className="text-cyan-400" />Inicio</span><input type="time" required value={formData.hora} onChange={(event) => cambiarHoraInicio(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-bold text-cyan-300 outline-none focus:border-cyan-500" /></label>
              <div className="hidden pb-3 text-cyan-400 md:block"><ArrowRight size={22} /></div>
              <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Clock size={15} className="text-cyan-400" />Fin</span><input type="time" required value={formData.horaFin} onChange={(event) => cambiarHoraFin(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-bold text-cyan-300 outline-none focus:border-cyan-500" /></label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Timer size={14} />Duración rápida</div>
              <div className="flex flex-wrap gap-2">
                {DURACIONES_RAPIDAS.map((duracion) => (
                  <button key={duracion} type="button" onClick={() => seleccionarDuracion(String(duracion))} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${formData.modoDuracion === String(duracion) ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'}`}>{duracion < 60 ? `${duracion} min` : duracion === 60 ? '1 hora' : `${duracion / 60} h`}</button>
                ))}
                <button type="button" onClick={() => seleccionarDuracion('libre')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${formData.modoDuracion === 'libre' ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'}`}>Personalizado</button>
              </div>
            </div>

            <div className={`mt-4 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${conflictoHorario ? 'border-rose-500/40 bg-rose-500/10' : duracionActual >= 5 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
              <div>
                <div className={`text-xs font-bold ${conflictoHorario ? 'text-rose-300' : duracionActual >= 5 ? 'text-emerald-300' : 'text-amber-300'}`}>{conflictoHorario ? 'Horario no disponible' : duracionActual >= 5 ? 'Horario disponible' : 'Revisa el horario'}</div>
                <div className="mt-0.5 text-xs text-slate-400">{formData.hora || '—'} <ArrowRight size={13} className="mx-1 inline" /> {formData.horaFin || '—'} · {duracionActual > 0 ? `${duracionActual} minutos` : 'duración inválida'}</div>
              </div>
              {conflictoHorario && <div className="flex items-start gap-2 rounded-lg bg-slate-950/40 px-3 py-2 text-xs text-rose-200"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>Ocupado por {pacientes.find((paciente) => Number(paciente.id) === Number(conflictoHorario.pacienteId))?.nombre || 'otro paciente'}: {conflictoHorario.hora} → {obtenerHoraFinCita(conflictoHorario)}</span></div>}
            </div>
          </section>

          <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="flex items-center gap-2 font-bold text-white"><FileText size={17} className="text-cyan-400" />Servicios de la atención</h3><p className="mt-0.5 text-xs text-slate-500">Agrega todos los procedimientos que se realizarán.</p></div>
              <button type="button" onClick={agregarServicio} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500"><Plus size={15} />Agregar servicio</button>
            </div>
            <div className="space-y-3">
              {formData.servicios.map((servicio, indice) => (
                <div key={servicio.clave} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                  <div className="grid gap-3 md:grid-cols-[92px_minmax(0,1fr)_150px_42px] md:items-end">
                    <div className="pb-2 text-xs font-black uppercase tracking-wider text-cyan-300">Servicio {indice + 1}</div>
                    <label className="text-xs font-medium text-slate-400">Procedimiento<select value={servicio.seleccion} onChange={(event) => actualizarServicio(servicio.clave, 'seleccion', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500">{PROCEDIMIENTOS.map((procedimiento) => <option key={procedimiento} value={procedimiento}>{procedimiento}</option>)}<option value="Otro">Otro servicio</option></select></label>
                    <label className="text-xs font-medium text-slate-400">Costo (S/.)<input type="number" min="0" step="0.01" disabled={sinCosto} value={sinCosto ? 0 : servicio.costo} onChange={(event) => actualizarServicio(servicio.clave, 'costo', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right font-bold text-white outline-none focus:border-cyan-500 disabled:opacity-50" /></label>
                    <button type="button" disabled={formData.servicios.length === 1} onClick={() => quitarServicio(servicio.clave)} title="Eliminar servicio" className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"><Trash2 size={16} /></button>
                  </div>
                  {servicio.seleccion === 'Otro' && <label className="mt-3 block text-xs font-medium text-slate-400 md:ml-[104px]">Nombre del servicio<input type="text" value={servicio.nombreOtro} onChange={(event) => actualizarServicio(servicio.clave, 'nombreOtro', event.target.value)} placeholder="Escribe el nombre del servicio..." className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500" /></label>}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-500/20 bg-slate-950/50 px-4 py-3"><span className="text-sm font-semibold text-slate-300">Total de servicios</span><span className="text-xl font-black text-cyan-300">S/. {costoNumerico.toFixed(2)}</span></div>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><CreditCard size={15} className="text-cyan-400" />Modalidad de pago</span><select name="tipoPago" value={formData.tipoPago} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"><option value="contado">Pagar después / al finalizar</option><option value="completo">Pagado completo hoy</option><option value="anticipo">Con anticipo</option><option value="cuotas">En cuotas</option><option value="cortesia">Cortesía / sin costo</option>{(citaEditar?.citaBaseId || formData.tipoPago === 'sesion') && <option value="sesion">Sesión incluida en plan</option>}</select></label>
            <label className="font-medium text-slate-300"><span className="mb-1.5 block">Estado</span><select name="estado" value={formData.estado} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"><option value="pendiente">Programado</option><option value="confirmada">Confirmado</option><option value="en_espera">En espera</option><option value="en_atencion">En atención</option><option value="completada">Finalizado</option><option value="no_asistio">No asistió</option><option value="cancelada">Cancelado</option></select></label>
          </div>

          {['completo', 'anticipo', 'cuotas'].includes(formData.tipoPago) && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="font-medium text-slate-300">Monto pagado hoy<input type="number" min="0" max={costoNumerico} step="0.01" name="montoPagado" value={formData.tipoPago === 'completo' ? costoNumerico : formData.montoPagado} disabled={formData.tipoPago === 'completo'} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 disabled:opacity-60" /></label><label className="font-medium text-slate-300">Método de pago<select name="metodoPago" value={formData.metodoPago} onChange={handleChange} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"><option>Efectivo</option><option>Yape</option><option>Plin</option><option value="Transferencia">Transferencia bancaria</option><option>Tarjeta</option></select></label></div>}

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-center"><div><div className="text-[11px] uppercase text-slate-500">Total</div><div className="font-bold text-white">S/. {costoNumerico.toFixed(2)}</div></div><div><div className="text-[11px] uppercase text-slate-500">Cobrado</div><div className="font-bold text-emerald-400">S/. {Math.min(cobradoPreview, costoNumerico).toFixed(2)}</div></div><div><div className="text-[11px] uppercase text-slate-500">Saldo</div><div className="font-bold text-rose-400">S/. {saldoPreview.toFixed(2)}</div></div></div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Layers size={15} className="text-cyan-400" />Sesión actual</span><input type="number" min="1" name="sesionNum" value={formData.sesionNum} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label><label className="font-medium text-slate-300"><span className="mb-1.5 flex items-center gap-1.5"><Layers size={15} className="text-cyan-400" />Total de sesiones</span><input type="number" min="1" name="totalSesiones" value={formData.totalSesiones} onChange={handleChange} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label></div>

          <label className="font-medium text-slate-300">Notas o indicaciones<textarea name="notas" value={formData.notas} onChange={handleChange} rows="3" placeholder="Observaciones clínicas o indicaciones..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500" /></label>

          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4"><button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-5 py-2.5 font-medium text-slate-200 hover:bg-slate-600">Cancelar</button><button type="submit" disabled={guardando || Boolean(conflictoHorario) || duracionActual < 5} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"><Save size={18} />{guardando ? 'Guardando...' : citaEditar?.id ? 'Guardar cambios' : 'Programar atención'}</button></div>
        </form>
      </div>
    </div>
  );
}
