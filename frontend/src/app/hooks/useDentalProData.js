import { useEffect, useState } from 'react';
import { api } from '../../services/api';

const crearCargador = (peticion, actualizar) => () =>
  peticion()
    .then((datos) => {
      const registros = datos || [];
      actualizar(registros);
      return registros;
    })
    .catch((error) => {
      console.error(error);
      throw error;
    });

export default function useDentalProData(usuarioActual) {
  const [pacientes, setPacientes] = useState([]);
  const [citas, setCitas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [planPagos, setPlanPagos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [casosClinicos, setCasosClinicos] = useState([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);

  const cargarPacientes = crearCargador(api.getPacientes, setPacientes);
  const cargarCitas = crearCargador(api.getCitas, setCitas);
  const cargarPagos = crearCargador(api.getPagos, setPagos);
  const cargarPlanPagos = crearCargador(api.getPlanPagos, setPlanPagos);
  const cargarPlanes = crearCargador(api.getPlanes, setPlanes);
  const cargarCasosClinicos = crearCargador(
    api.getCasosClinicos,
    setCasosClinicos
  );
  const cargarServiciosCatalogo = crearCargador(
    () => api.getServiciosCatalogo(usuarioActual?.rol === 'administrador'),
    setServiciosCatalogo
  );

  const limpiarDatos = () => {
    setPacientes([]);
    setCitas([]);
    setPagos([]);
    setPlanPagos([]);
    setPlanes([]);
    setCasosClinicos([]);
    setServiciosCatalogo([]);
  };

  useEffect(() => {
    let componenteActivo = true;

    if (usuarioActual && !usuarioActual.debeCambiarContrasena) {
      const puedeVerFinanzas = ['administrador', 'recepcion'].includes(
        usuarioActual.rol
      );
      const puedeVerClinica = ['administrador', 'odontologo'].includes(
        usuarioActual.rol
      );

      Promise.allSettled([
        api.getPacientes(),
        api.getCitas(),
        puedeVerFinanzas ? api.getPagos() : Promise.resolve([]),
        puedeVerFinanzas ? api.getPlanPagos() : Promise.resolve([]),
        puedeVerClinica ? api.getPlanes() : Promise.resolve([]),
        puedeVerClinica ? api.getCasosClinicos() : Promise.resolve([]),
        api.getServiciosCatalogo(usuarioActual.rol === 'administrador')
      ]).then((resultados) => {
        if (!componenteActivo) return;

        const obtenerDatos = (indice) =>
          resultados[indice].status === 'fulfilled'
            ? resultados[indice].value || []
            : [];

        setPacientes(obtenerDatos(0));
        setCitas(obtenerDatos(1));
        setPagos(obtenerDatos(2));
        setPlanPagos(obtenerDatos(3));
        setPlanes(obtenerDatos(4));
        setCasosClinicos(obtenerDatos(5));
        setServiciosCatalogo(obtenerDatos(6));

        const errores = resultados
          .filter((resultado) => resultado.status === 'rejected')
          .map((resultado) => resultado.reason);
        if (errores.length) {
          console.error('Algunos datos iniciales no pudieron cargarse:', errores);
        }
      });
    }

    return () => {
      componenteActivo = false;
    };
  }, [usuarioActual]);

  return {
    pacientes,
    citas,
    pagos,
    planPagos,
    planes,
    casosClinicos,
    serviciosCatalogo,
    cargarPacientes,
    cargarCitas,
    cargarPagos,
    cargarPlanPagos,
    cargarPlanes,
    cargarCasosClinicos,
    cargarServiciosCatalogo,
    limpiarDatos
  };
}
