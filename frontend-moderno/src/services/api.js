const API_URL = '/api';

// =====================================================
// MANEJO GENERAL DE RESPUESTAS
// =====================================================

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    const mensajeReal =
      errorData.detail ||
      errorData.message ||
      errorData.error ||
      `Error del servidor (${response.status}: ${response.statusText})`;

    throw new Error(mensajeReal);
  }

  // Algunas respuestas pueden no tener contenido.
  if (response.status === 204) {
    return null;
  }

  return response.json();
};


// =====================================================
// PETICIÓN GENERAL
// =====================================================

const request = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    return await handleResponse(response);
  } catch (error) {
    if (
      error.message === 'Failed to fetch' ||
      error.name === 'TypeError'
    ) {
      throw new Error(
        'No se pudo conectar con el servidor. Verifica que DentalPro esté ejecutándose.'
      );
    }

    throw error;
  }
};


// =====================================================
// API DENTALPRO
// =====================================================

export const api = {

  // ===================================================
  // PACIENTES
  // ===================================================

  getPacientes: () =>
    request(`${API_URL}/pacientes`),

  crearPaciente: (data) =>
    request(`${API_URL}/pacientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  actualizarPaciente: (id, data) =>
    request(`${API_URL}/pacientes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  eliminarPaciente: (id) =>
    request(`${API_URL}/pacientes/${id}`, {
      method: 'DELETE'
    }),


  // ===================================================
  // CITAS
  // ===================================================

  getCitas: () =>
    request(`${API_URL}/citas`),

  /*
   * Actualización normal de una cita.
   *
   * Se utiliza para:
   * - Cambiar el estado.
   * - Iniciar atención.
   * - Completar atención.
   * - Cancelar una cita.
   *
   * Esta operación no recalcula automáticamente el pago.
   */
  actualizarCita: (id, data) =>
    request(`${API_URL}/citas/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),


  // ===================================================
  // CITAS Y PAGOS INTEGRADOS
  // ===================================================

  /*
   * Crea una cita y su pago dentro de una misma
   * transacción del backend.
   */
  crearCitaConPago: (data) =>
    request(`${API_URL}/operaciones/citas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  /*
   * Actualiza simultáneamente la cita y su pago.
   */
  actualizarCitaConPago: (id, data) =>
    request(`${API_URL}/operaciones/citas/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  /*
   * Elimina una cita y su pago relacionado.
   *
   * El backend impedirá la eliminación cuando ya exista
   * dinero cobrado o un plan de cuotas relacionado.
   */
  eliminarCitaConPago: (id) =>
    request(`${API_URL}/operaciones/citas/${id}`, {
      method: 'DELETE'
    }),

  /*
   * Alias de compatibilidad.
   *
   * Permiten que componentes antiguos que todavía llaman
   * crearCita o eliminarCita sigan funcionando.
   */
  crearCita: (data) =>
    request(`${API_URL}/operaciones/citas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  eliminarCita: (id) =>
    request(`${API_URL}/operaciones/citas/${id}`, {
      method: 'DELETE'
    }),


  // ===================================================
  // PAGOS Y FINANZAS
  // ===================================================

  getPagos: () =>
    request(`${API_URL}/pagos`),

  crearPago: (data) =>
    request(`${API_URL}/pagos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  actualizarPago: (id, data) =>
    request(`${API_URL}/pagos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  eliminarPago: (id) =>
    request(`${API_URL}/pagos/${id}`, {
      method: 'DELETE'
    }),


  // ===================================================
  // PLANES DE PAGO
  // ===================================================

  getPlanPagos: () =>
    request(`${API_URL}/planPagos`),

  crearPlanPago: (data) =>
    request(`${API_URL}/planPagos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  actualizarPlanPago: (id, data) =>
    request(`${API_URL}/planPagos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  eliminarPlanPago: (id) =>
    request(`${API_URL}/planPagos/${id}`, {
      method: 'DELETE'
    }),


  // ===================================================
  // PLANES DE TRATAMIENTO
  // ===================================================

  getPlanes: () =>
    request(`${API_URL}/planes`),

  crearPlan: (data) =>
    request(`${API_URL}/planes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  actualizarPlan: (id, data) =>
    request(`${API_URL}/planes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }),

  eliminarPlan: (id) =>
    request(`${API_URL}/planes/${id}`, {
      method: 'DELETE'
    }),


  // ===================================================
  // EXPORTACIÓN E IMPORTACIÓN DE PACIENTES
  // ===================================================

  exportarPacientes: () => {
    window.location.href =
      `${API_URL}/exportar/pacientes`;
  },

  importarPacientes: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return request(
      `${API_URL}/importar/pacientes`,
      {
        method: 'POST',
        body: formData
      }
    );
  }
};