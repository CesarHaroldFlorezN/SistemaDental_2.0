import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Layers,
  Save,
  Search,
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

const crearEstadoInicial = (citaEditar, pagoEditar, pacientes) => {
  const procedimientoGuardado =
    citaEditar?.procedimiento || 'Consulta de evaluación';
  const procedimientoEsLista = PROCEDIMIENTOS.includes(procedimientoGuardado);

  return {
    pacienteId: citaEditar?.pacienteId ?? pacientes[0]?.id ?? '',
    fecha: citaEditar?.fecha || obtenerFechaLocal(),
    hora: citaEditar?.hora || '09:00',
    procedimiento: procedimientoEsLista ? procedimientoGuardado : 'Otro',
    procedimientoOtro: procedimientoEsLista ? '' : procedimientoGuardado,
    costo: citaEditar?.costo ?? 0,
    tipoPago: citaEditar?.tipoPago || 'contado',
    montoPagado: pagoEditar?.cobrado ?? 0,
    metodoPago:
      pagoEditar?.metodo &&
      !['Pendiente', '—'].includes(pagoEditar.metodo)
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
      const texto = normalizar(
        [
          paciente.nombre,
          paciente.cedula,
          paciente.codigo_ficha,
          paciente.telefono,
          paciente.correo
        ].join(' ')
      );
      return terminos.every((termino) => texto.includes(termino));
    });
  }, [busquedaPaciente, pacientes]);

  if (!isOpen) return null;

  const costoNumerico =
    ['cortesia', 'sesion'].includes(formData.tipoPago)
      ? 0
      : Math.max(0, Number(formData.costo) || 0);

  let cobradoPreview = Math.max(0, Number(formData.montoPagado) || 0);
  if (formData.tipoPago === 'completo') cobradoPreview = costoNumerico;
  if (['contado', 'cortesia', 'sesion'].includes(formData.tipoPago)) {
    cobradoPreview = 0;
  }

  const saldoPreview = Math.max(0, costoNumerico - cobradoPreview);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setErrorFormulario('');

    setFormData((prev) => {
      const siguiente = { ...prev, [name]: value };

      if (name === 'tipoPago') {
        if (value === 'completo') {
          siguiente.montoPagado = Number(prev.costo) || 0;
        }
        if (['contado', 'cortesia', 'sesion'].includes(value)) {
          siguiente.montoPagado = 0;
        }
      }

      if (name === 'costo' && prev.tipoPago === 'completo') {
        siguiente.montoPagado = Number(value) || 0;
      }

      return siguiente;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const pacienteId = Number.parseInt(formData.pacienteId, 10);
    let costo = Math.max(0, Number(formData.costo) || 0);
    let montoPagado = Math.max(0, Number(formData.montoPagado) || 0);
    const procedimiento =
      formData.procedimiento === 'Otro'
        ? formData.procedimientoOtro.trim()
        : formData.procedimiento.trim();

    if (!pacienteId) {
      setErrorFormulario('Debes seleccionar un paciente.');
      return;
    }
    if (!formData.fecha || !formData.hora) {
      setErrorFormulario('Debes indicar la fecha y la hora de la cita.');
      return;
    }
    if (!procedimiento) {
      setErrorFormulario('Debes escribir el procedimiento que se realizará.');
      return;
    }

    if (['cortesia', 'sesion'].includes(formData.tipoPago)) {
      costo = 0;
      montoPagado = 0;
    }
    if (formData.tipoPago === 'contado') montoPagado = 0;
    if (formData.tipoPago === 'completo') montoPagado = costo;

    if (montoPagado > costo) {
      setErrorFormulario('El monto pagado no puede superar el costo total.');
      return;
    }
    if (formData.tipoPago === 'anticipo' && montoPagado <= 0) {
      setErrorFormulario('Debes ingresar el monto del anticipo.');
      return;
    }
    if (formData.tipoPago === 'anticipo' && montoPagado >= costo) {
      setErrorFormulario(
        'El anticipo debe ser menor al costo. Si pagó todo, elige “Pagado completo”.'
      );
      return;
    }
    if (formData.tipoPago === 'cuotas' && costo <= 0) {
      setErrorFormulario('Una cita en cuotas debe tener un costo mayor que cero.');
      return;
    }

    const sesionNum = Math.max(1, Number.parseInt(formData.sesionNum, 10) || 1);
    const totalSesiones = Math.max(
      1,
      Number.parseInt(formData.totalSesiones, 10) || 1
    );

    if (sesionNum > totalSesiones) {
      setErrorFormulario(
        'La sesión actual no puede superar el total de sesiones.'
      );
      return;
    }

    const payload = {
      pacienteId,
      planId: citaEditar?.planId ?? null,
      citaBaseId: citaEditar?.citaBaseId ?? null,
      fecha: formData.fecha,
      hora: formData.hora,
      procedimiento,
      costo,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-cyan-400">
            <Calendar size={20} />
            {citaEditar?.id ? 'Editar cita clínica' : 'Agendar nueva cita'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-700 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 overflow-y-auto p-6 text-sm"
        >
          {errorFormulario && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
              {errorFormulario}
            </div>
          )}

          <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <label className="mb-2 flex items-center gap-1.5 font-medium text-slate-300">
              <User size={15} className="text-cyan-400" />
              Paciente <span className="text-red-400">*</span>
            </label>

            <div className="relative mb-2">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="search"
                value={busquedaPaciente}
                onChange={(event) => setBusquedaPaciente(event.target.value)}
                placeholder="Buscar por nombre, DNI, ficha o teléfono..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

            <select
              name="pacienteId"
              required
              value={formData.pacienteId}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-medium text-white outline-none focus:border-cyan-500"
            >
              <option value="">-- Selecciona un paciente --</option>
              {pacientesFiltrados.map((paciente) => (
                <option key={paciente.id} value={paciente.id}>
                  {paciente.codigo_ficha ? `[${paciente.codigo_ficha}] ` : ''}
                  {paciente.nombre}
                  {paciente.cedula ? ` · DNI ${paciente.cedula}` : ''}
                </option>
              ))}
            </select>

            {pacientesFiltrados.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">
                No se encontraron pacientes con esa búsqueda.
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
                <Calendar size={15} className="text-cyan-400" /> Fecha
              </label>
              <input
                type="date"
                name="fecha"
                required
                value={formData.fecha}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
                <Clock size={15} className="text-cyan-400" /> Hora
              </label>
              <input
                type="time"
                name="hora"
                required
                value={formData.hora}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-semibold text-cyan-300 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
              <FileText size={15} className="text-cyan-400" /> Procedimiento
            </label>
            <select
              name="procedimiento"
              value={formData.procedimiento}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
            >
              {PROCEDIMIENTOS.map((procedimiento) => (
                <option key={procedimiento} value={procedimiento}>
                  {procedimiento}
                </option>
              ))}
              <option value="Otro">Otro procedimiento</option>
            </select>

            {formData.procedimiento === 'Otro' && (
              <input
                type="text"
                name="procedimientoOtro"
                value={formData.procedimientoOtro}
                onChange={handleChange}
                placeholder="Escribe el procedimiento..."
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
                <DollarSign size={15} className="text-cyan-400" /> Costo total
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                name="costo"
                value={['cortesia', 'sesion'].includes(formData.tipoPago) ? 0 : formData.costo}
                disabled={['cortesia', 'sesion'].includes(formData.tipoPago)}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
                <CreditCard size={15} className="text-cyan-400" /> Modalidad de pago
              </label>
              <select
                name="tipoPago"
                value={formData.tipoPago}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
              >
                <option value="contado">Pagar después / al finalizar</option>
                <option value="completo">Pagado completo hoy</option>
                <option value="anticipo">Con anticipo</option>
                <option value="cuotas">En cuotas</option>
                <option value="cortesia">Cortesía / sin costo</option>
                {(citaEditar?.citaBaseId || formData.tipoPago === 'sesion') && (
                  <option value="sesion">Sesión incluida en plan</option>
                )}
              </select>
            </div>
          </div>

          {['completo', 'anticipo', 'cuotas'].includes(formData.tipoPago) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-medium text-slate-300">
                  Monto pagado hoy
                </label>
                <input
                  type="number"
                  min="0"
                  max={costoNumerico}
                  step="0.01"
                  name="montoPagado"
                  value={
                    formData.tipoPago === 'completo'
                      ? costoNumerico
                      : formData.montoPagado
                  }
                  disabled={formData.tipoPago === 'completo'}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-medium text-slate-300">
                  Método de pago
                </label>
                <select
                  name="metodoPago"
                  value={formData.metodoPago}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Yape">Yape</option>
                  <option value="Plin">Plin</option>
                  <option value="Transferencia">Transferencia bancaria</option>
                  <option value="Tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>
          )}

          {formData.tipoPago === 'cuotas' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              La cita quedará marcada como financiada. El cronograma se administra en
              <strong> Planes de Pago</strong>.
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Total</div>
              <div className="mt-1 font-bold text-white">S/. {costoNumerico.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Cobrado</div>
              <div className="mt-1 font-bold text-emerald-400">
                S/. {Math.min(cobradoPreview, costoNumerico).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Saldo</div>
              <div className="mt-1 font-bold text-rose-400">S/. {saldoPreview.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block font-medium text-slate-300">Estado</label>
              <select
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
              >
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="en_espera">En espera</option>
                <option value="en_atencion">En atención</option>
                <option value="completada">Atendida</option>
                <option value="no_asistio">No asistió</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
                <Layers size={15} className="text-cyan-400" /> Sesión actual
              </label>
              <input
                type="number"
                min="1"
                name="sesionNum"
                value={formData.sesionNum}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
                <Layers size={15} className="text-cyan-400" /> Total de sesiones
              </label>
              <input
                type="number"
                min="1"
                name="totalSesiones"
                value={formData.totalSesiones}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-medium text-slate-300">
              Notas o indicaciones
            </label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleChange}
              rows="3"
              placeholder="Síntomas, alergias, observaciones o indicaciones..."
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-700/80 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="rounded-xl bg-slate-700 px-5 py-2.5 font-medium text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 disabled:cursor-wait disabled:opacity-60"
            >
              <Save size={18} />
              {guardando
                ? 'Guardando...'
                : citaEditar?.id
                  ? 'Actualizar cita'
                  : 'Agendar cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
