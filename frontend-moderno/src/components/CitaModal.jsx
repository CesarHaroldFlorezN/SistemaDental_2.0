import { useEffect, useState } from 'react';
import {
  X,
  Save,
  Calendar,
  Clock,
  User,
  FileText,
  DollarSign,
  Layers,
  CreditCard
} from 'lucide-react';


// =====================================================
// FECHA LOCAL
// Evita errores de fecha producidos por toISOString()
// =====================================================

const obtenerFechaLocal = () => {
  const ahora = new Date();

  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


// =====================================================
// ESTADO INICIAL DEL FORMULARIO
// =====================================================

const crearEstadoInicial = (
  citaEditar,
  pagoEditar,
  pacientes
) => ({
  pacienteId:
    citaEditar?.pacienteId ??
    pacientes[0]?.id ??
    '',

  fecha:
    citaEditar?.fecha ||
    obtenerFechaLocal(),

  hora:
    citaEditar?.hora ||
    '09:00',

  procedimiento:
    citaEditar?.procedimiento ||
    'Consulta de evaluación',

  costo:
    citaEditar?.costo ??
    0,

  tipoPago:
    citaEditar?.tipoPago ||
    'contado',

  montoPagado:
    pagoEditar?.cobrado ??
    0,

  metodoPago:
    pagoEditar?.metodo &&
    pagoEditar.metodo !== 'Pendiente' &&
    pagoEditar.metodo !== '—'
      ? pagoEditar.metodo
      : 'Efectivo',

  estado:
    citaEditar?.estado ||
    'pendiente',

  sesionNum:
    citaEditar?.sesionNum ??
    1,

  totalSesiones:
    citaEditar?.totalSesiones ??
    1,

  notas:
    citaEditar?.notas ||
    ''
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
    crearEstadoInicial(
      citaEditar,
      pagoEditar,
      pacientes
    )
  );

  const [errorFormulario, setErrorFormulario] =
    useState('');


  // ===================================================
  // REINICIAR FORMULARIO
  // ===================================================

  useEffect(() => {
    if (!isOpen) return;

    setFormData(
      crearEstadoInicial(
        citaEditar,
        pagoEditar,
        pacientes
      )
    );

    setErrorFormulario('');
  }, [
    isOpen,
    citaEditar,
    pagoEditar,
    pacientes
  ]);


  if (!isOpen) {
    return null;
  }


  // ===================================================
  // VALORES CALCULADOS
  // ===================================================

  const costoNumerico =
    formData.tipoPago === 'cortesia'
      ? 0
      : Math.max(
          0,
          parseFloat(formData.costo) || 0
        );

  let cobradoPreview = Math.max(
    0,
    parseFloat(formData.montoPagado) || 0
  );

  if (formData.tipoPago === 'completo') {
    cobradoPreview = costoNumerico;
  }

  if (
    formData.tipoPago === 'contado' ||
    formData.tipoPago === 'cortesia'
  ) {
    cobradoPreview = 0;
  }

  const saldoPreview = Math.max(
    0,
    costoNumerico - cobradoPreview
  );


  // ===================================================
  // CAMBIOS DEL FORMULARIO
  // ===================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setErrorFormulario('');

    setFormData((prev) => {
      const nuevoEstado = {
        ...prev,
        [name]: value
      };

      if (name === 'tipoPago') {
        if (value === 'completo') {
          nuevoEstado.montoPagado =
            parseFloat(prev.costo) || 0;
        }

        if (
          value === 'contado' ||
          value === 'cortesia'
        ) {
          nuevoEstado.montoPagado = 0;
        }
      }

      if (
        name === 'costo' &&
        prev.tipoPago === 'completo'
      ) {
        nuevoEstado.montoPagado =
          parseFloat(value) || 0;
      }

      return nuevoEstado;
    });
  };


  // ===================================================
  // GUARDAR
  // ===================================================

  const handleSubmit = (event) => {
    event.preventDefault();

    const pacienteId = parseInt(
      formData.pacienteId,
      10
    );

    let costo = Math.max(
      0,
      parseFloat(formData.costo) || 0
    );

    let montoPagado = Math.max(
      0,
      parseFloat(formData.montoPagado) || 0
    );

    if (!pacienteId) {
      setErrorFormulario(
        'Debes seleccionar un paciente.'
      );
      return;
    }

    if (!formData.fecha) {
      setErrorFormulario(
        'Debes seleccionar la fecha de la cita.'
      );
      return;
    }

    if (!formData.hora) {
      setErrorFormulario(
        'Debes indicar la hora de la cita.'
      );
      return;
    }

    if (!formData.procedimiento?.trim()) {
      setErrorFormulario(
        'Debes indicar el procedimiento.'
      );
      return;
    }

    if (formData.tipoPago === 'cortesia') {
      costo = 0;
      montoPagado = 0;
    }

    if (formData.tipoPago === 'contado') {
      montoPagado = 0;
    }

    if (formData.tipoPago === 'completo') {
      montoPagado = costo;
    }

    if (montoPagado > costo) {
      setErrorFormulario(
        'El monto pagado no puede superar el costo total.'
      );
      return;
    }

    if (
      formData.tipoPago === 'anticipo' &&
      montoPagado <= 0
    ) {
      setErrorFormulario(
        'Debes ingresar el monto del anticipo.'
      );
      return;
    }

    if (
      formData.tipoPago === 'anticipo' &&
      montoPagado >= costo
    ) {
      setErrorFormulario(
        'El anticipo debe ser menor al costo total. Si ya pagó todo, selecciona "Pagado completo hoy".'
      );
      return;
    }

    const sesionNum = Math.max(
      1,
      parseInt(formData.sesionNum, 10) || 1
    );

    const totalSesiones = Math.max(
      1,
      parseInt(formData.totalSesiones, 10) || 1
    );

    if (sesionNum > totalSesiones) {
      setErrorFormulario(
        'La sesión actual no puede superar el total de sesiones.'
      );
      return;
    }

    const payload = {
      pacienteId,

      planId:
        citaEditar?.planId ??
        null,

      citaBaseId:
        citaEditar?.citaBaseId ??
        null,

      fecha:
        formData.fecha,

      hora:
        formData.hora,

      procedimiento:
        formData.procedimiento.trim(),

      costo,

      tipoPago:
        formData.tipoPago,

      montoPagado,

      metodoPago:
        montoPagado > 0
          ? formData.metodoPago
          : 'Pendiente',

      estado:
        formData.estado,

      sesionNum,

      totalSesiones,

      notas:
        formData.notas.trim()
    };

    onSave(
      payload,
      citaEditar?.id
    );
  };


  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">

      <div className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">

        {/* CABECERA */}

        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-800/50">

          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <Calendar size={20} />

            {citaEditar
              ? 'Editar Cita Clínica'
              : 'Agendar Nueva Cita'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition cursor-pointer"
          >
            <X size={20} />
          </button>

        </div>


        {/* FORMULARIO */}

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 text-sm overflow-y-auto"
        >

          {/* ERROR */}

          {errorFormulario && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
              {errorFormulario}
            </div>
          )}


          {/* PACIENTE */}

          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <User
                size={15}
                className="text-cyan-400"
              />

              Paciente

              <span className="text-red-400">
                *
              </span>
            </label>

            <select
              name="pacienteId"
              required
              value={formData.pacienteId}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition font-medium"
            >
              <option value="">
                -- Selecciona un paciente --
              </option>

              {pacientes.map((paciente) => (
                <option
                  key={paciente.id}
                  value={paciente.id}
                >
                  {paciente.codigo_ficha
                    ? `[${paciente.codigo_ficha}] `
                    : ''}

                  {paciente.nombre}

                  {paciente.cedula
                    ? ` (DNI: ${paciente.cedula})`
                    : ''}
                </option>
              ))}
            </select>
          </div>


          {/* FECHA Y HORA */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar
                  size={15}
                  className="text-cyan-400"
                />

                Fecha
              </label>

              <input
                type="date"
                name="fecha"
                required
                value={formData.fecha}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Clock
                  size={15}
                  className="text-cyan-400"
                />

                Hora
              </label>

              <input
                type="time"
                name="hora"
                required
                value={formData.hora}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition font-semibold text-cyan-400"
              />
            </div>

          </div>


          {/* PROCEDIMIENTO */}

          <div>
            <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
              <FileText
                size={15}
                className="text-cyan-400"
              />

              Procedimiento / Tratamiento
            </label>

            <select
              name="procedimiento"
              value={formData.procedimiento}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
            >
              <option value="Consulta de evaluación">
                Consulta de evaluación
              </option>

              <option value="Limpieza dental">
                Limpieza dental
              </option>

              <option value="Empaste / Resina">
                Empaste / Resina
              </option>

              <option value="Endodoncia (canal)">
                Endodoncia (canal)
              </option>

              <option value="Extracción simple">
                Extracción simple
              </option>

              <option value="Extracción muela juicio">
                Extracción muela juicio
              </option>

              <option value="Corona dental">
                Corona dental
              </option>

              <option value="Implante dental">
                Implante dental
              </option>

              <option value="Blanqueamiento">
                Blanqueamiento
              </option>

              <option value="Ortodoncia — colocación">
                Ortodoncia — colocación
              </option>

              <option value="Ortodoncia — control">
                Ortodoncia — control
              </option>

              <option value="Prótesis dental">
                Prótesis dental
              </option>

              <option value="Rayos X">
                Rayos X
              </option>

              <option value="Cirugía oral">
                Cirugía oral
              </option>

              <option value="Otro">
                Otro procedimiento
              </option>
            </select>
          </div>


          {/* COSTO Y TIPO DE PAGO */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <DollarSign
                  size={15}
                  className="text-cyan-400"
                />

                Costo total (S/.)
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                name="costo"
                value={
                  formData.tipoPago === 'cortesia'
                    ? 0
                    : formData.costo
                }
                disabled={
                  formData.tipoPago === 'cortesia'
                }
                onChange={handleChange}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <CreditCard
                  size={15}
                  className="text-cyan-400"
                />

                Modalidad de pago
              </label>

              <select
                name="tipoPago"
                value={formData.tipoPago}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              >
                <option value="contado">
                  Pagar después / Al finalizar
                </option>

                <option value="completo">
                  Pagado completo hoy
                </option>

                <option value="anticipo">
                  Con anticipo
                </option>

                <option value="cuotas">
                  En cuotas
                </option>

                <option value="cortesia">
                  Cortesía / Sin costo
                </option>
              </select>
            </div>

          </div>


          {/* MONTO PAGADO Y MÉTODO */}

          {[
            'completo',
            'anticipo',
            'cuotas'
          ].includes(formData.tipoPago) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
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
                  disabled={
                    formData.tipoPago === 'completo'
                  }
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Método de pago
                </label>

                <select
                  name="metodoPago"
                  value={formData.metodoPago}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
                >
                  <option value="Efectivo">
                    Efectivo
                  </option>

                  <option value="Yape">
                    Yape
                  </option>

                  <option value="Plin">
                    Plin
                  </option>

                  <option value="Transferencia">
                    Transferencia bancaria
                  </option>

                  <option value="Tarjeta">
                    Tarjeta
                  </option>
                </select>
              </div>

            </div>
          )}


          {/* RESUMEN FINANCIERO */}

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">

            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Total
              </div>

              <div className="mt-1 font-bold text-white">
                S/. {costoNumerico.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Cobrado
              </div>

              <div className="mt-1 font-bold text-emerald-400">
                S/. {Math.min(
                  cobradoPreview,
                  costoNumerico
                ).toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Saldo
              </div>

              <div className="mt-1 font-bold text-rose-400">
                S/. {saldoPreview.toFixed(2)}
              </div>
            </div>

          </div>


          {/* ESTADO Y SESIONES */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Estado de la cita
              </label>

              <select
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              >
                <option value="pendiente">
                  Pendiente
                </option>

                <option value="en_atencion">
                  En atención
                </option>

                <option value="completada">
                  Completada
                </option>

                <option value="cancelada">
                  Cancelada
                </option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Layers
                  size={15}
                  className="text-cyan-400"
                />

                Sesión actual
              </label>

              <input
                type="number"
                min="1"
                name="sesionNum"
                value={formData.sesionNum}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Layers
                  size={15}
                  className="text-cyan-400"
                />

                Total de sesiones
              </label>

              <input
                type="number"
                min="1"
                name="totalSesiones"
                value={formData.totalSesiones}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition"
              />
            </div>

          </div>


          {/* NOTAS */}

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Notas o indicaciones
            </label>

            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleChange}
              rows="3"
              placeholder="Síntomas, alergias, observaciones o indicaciones médicas..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-cyan-500 outline-none transition resize-none"
            />
          </div>


          {/* BOTONES */}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/80">

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
            >
              <Save size={18} />

              {citaEditar?.id
                ? 'Actualizar Cita'
                : 'Agendar Cita'}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}