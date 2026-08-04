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
    const response = await fetch(url, options);
    return await handleResponse(response);
  } catch (error) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(
        'No se pudo conectar con el servidor. Verifica que DentalPro esté ejecutándose.'
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
  // PAGOS Y FINANZAS
  // ===================================================
  getPagos: () => request(`${API_URL}/pagos`),

  crearPago: (data) =>
    request(`${API_URL}/pagos`, jsonOptions('POST', data)),

  actualizarPago: (id, data) =>
    request(`${API_URL}/pagos/${id}`, jsonOptions('PUT', data)),

  eliminarPago: (id) =>
    request(`${API_URL}/pagos/${id}`, { method: 'DELETE' }),

  // ===================================================
  // PLANES DE PAGO
  // ===================================================
  getPlanPagos: () => request(`${API_URL}/planPagos`),

  crearPlanPago: (data) =>
    request(`${API_URL}/planPagos`, jsonOptions('POST', data)),

  actualizarPlanPago: (id, data) =>
    request(`${API_URL}/planPagos/${id}`, jsonOptions('PUT', data)),

  eliminarPlanPago: (id) =>
    request(`${API_URL}/planPagos/${id}`, { method: 'DELETE' }),

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
