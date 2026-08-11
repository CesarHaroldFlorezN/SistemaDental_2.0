const API_URL = '/api';

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.detail;

    const mensajeReal = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join(' · ')
      : detail ||
        errorData.message ||
        errorData.error ||
        `Error del servidor (${response.status}: ${response.statusText})`;

    throw new Error(mensajeReal);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return response.text();

  return response.json();
};

const request = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
  credentials: 'include',
  ...options
});
    return await handleResponse(response);
  } catch (error) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(
  'No se pudo conectar con el servidor. Verifica que DentalPro esté ejecutándose.',
  { cause: error }
);
    }

    throw error;
  }
};

const jsonOptions = (method, data) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const api = {


    // ===================================================
  // AUTENTICACIÓN
  // ===================================================
  iniciarSesion: (nombreUsuario, contrasena) =>
    request(
      `${API_URL}/auth/login`,
      jsonOptions('POST', {
        nombreUsuario,
        contrasena
      })
    ),

  obtenerSesion: () =>
    request(`${API_URL}/auth/me`),

  cerrarSesion: () =>
    request(
      `${API_URL}/auth/logout`,
      {
        method: 'POST'
      }
    ),

  // ===================================================
  // PACIENTES
  // ===================================================
  getPacientes: () => request(`${API_URL}/pacientes`),

  crearPaciente: (data) =>
    request(`${API_URL}/pacientes`, jsonOptions('POST', data)),

  actualizarPaciente: (id, data) =>
    request(`${API_URL}/pacientes/${id}`, jsonOptions('PUT', data)),

  eliminarPaciente: (id) =>
    request(`${API_URL}/pacientes/${id}`, { method: 'DELETE' }),

  // ===================================================
  // CITAS
  // ===================================================
  getCitas: () => request(`${API_URL}/citas`),

  actualizarCita: (id, data) =>
    request(`${API_URL}/citas/${id}`, jsonOptions('PUT', data)),

  crearCitaConPago: (data) =>
    request(`${API_URL}/operaciones/citas`, jsonOptions('POST', data)),

  actualizarCitaConPago: (id, data) =>
    request(
      `${API_URL}/operaciones/citas/${id}`,
      jsonOptions('PUT', data)
    ),

  eliminarCitaConPago: (id) =>
    request(`${API_URL}/operaciones/citas/${id}`, { method: 'DELETE' }),

  cambiarEstadoCita: (id, estado) =>
    request(
      `${API_URL}/operaciones/citas/${id}/estado`,
      jsonOptions('PATCH', { estado })
    ),

  reprogramarCita: (id, data) =>
    request(
      `${API_URL}/operaciones/citas/${id}/reprogramar`,
      jsonOptions('PATCH', data)
    ),

  // Alias para componentes antiguos.
  crearCita: (data) =>
    request(`${API_URL}/operaciones/citas`, jsonOptions('POST', data)),

  eliminarCita: (id) =>
    request(`${API_URL}/operaciones/citas/${id}`, { method: 'DELETE' }),

  // ===================================================
  // CASOS CLÍNICOS Y SESIONES PLANIFICADAS
  // ===================================================
  getCasosClinicos: (pacienteId = null) =>
    request(`${API_URL}/casosClinicos${pacienteId ? `?pacienteId=${pacienteId}` : ''}`),

  crearCasoClinico: (data) =>
    request(`${API_URL}/casosClinicos`, jsonOptions('POST', data)),

  actualizarCasoClinico: (id, data) =>
    request(`${API_URL}/casosClinicos/${id}`, jsonOptions('PUT', data)),

  registrarDiagnosticoCaso: (id, data) =>
    request(`${API_URL}/casosClinicos/${id}/diagnostico`, jsonOptions('PATCH', data)),

  getSesionesPlan: (planId = null) =>
    request(`${API_URL}/sesionesPlan${planId ? `?planId=${planId}` : ''}`),

  // ===================================================
  // PAGOS Y FINANZAS
  // ===================================================
  getPagos: () => request(`${API_URL}/pagos`),

  crearPago: (data) =>
    request(`${API_URL}/pagos`, jsonOptions('POST', data)),

  actualizarPago: (id, data) =>
    request(`${API_URL}/pagos/${id}`, jsonOptions('PUT', data)),

  eliminarPago: (id) =>
    request(`${API_URL}/pagos/${id}`, { method: 'DELETE' }),

  // DENTALPRO_V8_CUENTA: operaciones financieras auditables.
  registrarPago: (id, data) =>
    request(`${API_URL}/operaciones/pagos/${id}/registrar`, jsonOptions('POST', data)),

  anularPago: (id, data) =>
    request(`${API_URL}/operaciones/pagos/${id}/anular`, jsonOptions('POST', data)),

  devolverPago: (id, data) =>
    request(`${API_URL}/operaciones/pagos/${id}/devolver`, jsonOptions('POST', data)),

  getCuentaPaciente: (pacienteId) =>
    request(`${API_URL}/pacientes/${pacienteId}/cuenta`),

  crearMovimientoCuenta: (data) =>
    request(`${API_URL}/movimientosCuenta`, jsonOptions('POST', data)),

  getDocumentosPaciente: (pacienteId) =>
    request(`${API_URL}/pacientes/${pacienteId}/documentos`),

  subirDocumentoPaciente: (pacienteId, file, descripcion = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('descripcion', descripcion);
    return request(`${API_URL}/pacientes/${pacienteId}/documentos`, { method: 'POST', body: formData });
  },

  descargarDocumentoPaciente: (pacienteId, documentoId) => {
    window.open(`${API_URL}/pacientes/${pacienteId}/documentos/${documentoId}/descargar`, '_blank', 'noopener,noreferrer');
  },

  eliminarDocumentoPaciente: (pacienteId, documentoId) =>
    request(`${API_URL}/pacientes/${pacienteId}/documentos/${documentoId}`, { method: 'DELETE' }),

  // ===================================================
  // PLANES DE PAGO
  // ===================================================
  getPlanPagos: () => request(`${API_URL}/planPagos`),

  crearPlanPago: (data) =>
    request(`${API_URL}/planPagos`, jsonOptions('POST', data)),

  actualizarPlanPago: (id, data) =>
    request(`${API_URL}/planPagos/${id}`, jsonOptions('PUT', data)),

  registrarAdelantoPlanPago: (id, data) =>
    request(`${API_URL}/planPagos/${id}/adelantos`, jsonOptions('POST', data)),

  eliminarPlanPago: (id) =>
    request(`${API_URL}/planPagos/${id}`, { method: 'DELETE' }),

  // ===================================================
  // ODONTOGRAMA CLÍNICO
  // ===================================================
  getOdontogramas: (pacienteId) =>
    request(`${API_URL}/odontogramas?pacienteId=${pacienteId}`),

  crearOdontograma: (data) =>
    request(`${API_URL}/odontogramas`, jsonOptions('POST', data)),

  // ===================================================
  // PLANES DE TRATAMIENTO
  // ===================================================
  getPlanes: () => request(`${API_URL}/planes`),

  crearPlan: (data) =>
    request(`${API_URL}/planes`, jsonOptions('POST', data)),

  actualizarPlan: (id, data) =>
    request(`${API_URL}/planes/${id}`, jsonOptions('PUT', data)),

  eliminarPlan: (id) =>
    request(`${API_URL}/planes/${id}`, { method: 'DELETE' }),

  // ===================================================
  // IMPORTACIÓN Y EXPORTACIÓN
  // ===================================================
  exportarPacientes: () => {
    window.location.href = `${API_URL}/exportar/pacientes`;
  },

  importarPacientes: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return request(`${API_URL}/importar/pacientes`, {
      method: 'POST',
      body: formData
    });
  }
};
