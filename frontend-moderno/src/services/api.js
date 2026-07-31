const API_URL = 'http://127.0.0.1:8000/api';

// Función auxiliar para manejar respuestas y errores de red
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
  return response.json();
};

// Función auxiliar para peticiones que traduce "Failed to fetch"
const request = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    return await handleResponse(res);
  } catch (error) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(
        'No se pudo conectar con el servidor Python (http://127.0.0.1:8000). Revisa que main.py esté ejecutándose.'
      );
    }
    throw error;
  }
};

export const api = {
  // Pacientes
  getPacientes: () => request(`${API_URL}/pacientes`),
  crearPaciente: (data) => request(`${API_URL}/pacientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  actualizarPaciente: (id, data) => request(`${API_URL}/pacientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  eliminarPaciente: (id) => request(`${API_URL}/pacientes/${id}`, {
    method: 'DELETE'
  }),

  // Citas
  getCitas: () => request(`${API_URL}/citas`),
  crearCita: (data) => request(`${API_URL}/citas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  actualizarCita: (id, data) => request(`${API_URL}/citas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  eliminarCita: (id) => request(`${API_URL}/citas/${id}`, {
    method: 'DELETE'
  }),

  // Pagos y Finanzas
  getPagos: () => request(`${API_URL}/pagos`),
  crearPago: (data) => request(`${API_URL}/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  actualizarPago: (id, data) => request(`${API_URL}/pagos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),

  // Planes de Pago (Cuotas)
  getPlanPagos: () => request(`${API_URL}/planPagos`),
  crearPlanPago: (data) => request(`${API_URL}/planPagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  actualizarPlanPago: (id, data) => request(`${API_URL}/planPagos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  eliminarPlanPago: (id) => request(`${API_URL}/planPagos/${id}`, {
    method: 'DELETE'
  }),

  // Planes de Tratamiento
  getPlanes: () => request(`${API_URL}/planes`),
  crearPlan: (data) => request(`${API_URL}/planes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  actualizarPlan: (id, data) => request(`${API_URL}/planes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  eliminarPlan: (id) => request(`${API_URL}/planes/${id}`, {
    method: 'DELETE'
  }),
};