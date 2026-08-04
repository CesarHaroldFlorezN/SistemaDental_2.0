import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  Edit3,
  FileText,
  FolderOpen,
  History,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
  X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../services/api';

const moneda = (valor) => `S/. ${Number(valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaHoy = () => new Date().toISOString().slice(0, 10);
const sumarDias = (fecha, dias) => { const valor = new Date(`${fecha}T12:00:00`); valor.setDate(valor.getDate() + Number(dias || 0)); return valor.toISOString().slice(0, 10); };
const serviciosDeCita = (cita) => Array.isArray(cita?.servicios) && cita.servicios.length ? cita.servicios : [{ nombre: cita?.procedimiento || 'Consulta', costo: cita?.costo || 0 }];

const estadoTexto = (estado) => ({ pendiente: 'Programada', confirmada: 'Programada', en_espera: 'En espera', en_atencion: 'En atencion', completada: 'Finalizada', cancelada: 'Cancelada', no_asistio: 'No asistio' }[estado] || estado || 'Programada');

export default function FichaPaciente360Modal({
  isOpen,
  onClose,
  paciente,
  citas = [],
  pagos = [],
  planes = [],
  planPagos = [],
  onNuevaCita,
  onEditarPaciente,
  onCrearPlan,
  onVerPlanPagos,
  onDatosActualizados
}) {
  const [pestana, setPestana] = useState('resumen');
  const [cuenta, setCuenta] = useState({ movimientos: [], resumen: {} });
  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cronograma, setCronograma] = useState(null);

  const citasPaciente = useMemo(() => citas.filter((c) => Number(c.pacienteId) === Number(paciente?.id)).sort((a, b) => `${b.fecha || ''}${b.hora || ''}`.localeCompare(`${a.fecha || ''}${a.hora || ''}`)), [citas, paciente]);
  const pagosPaciente = useMemo(() => pagos.filter((p) => Number(p.pacienteId) === Number(paciente?.id)), [pagos, paciente]);
  const planesPaciente = useMemo(() => planes.filter((p) => Number(p.pacienteId) === Number(paciente?.id)), [planes, paciente]);
  const totalPagado = pagosPaciente.reduce((s, p) => s + Number(p.cobrado || 0), 0);
  const saldoPendiente = pagosPaciente.reduce((s, p) => s + Number(p.saldo || 0), 0);
  const creditoFavor = pagosPaciente.reduce((s, p) => s + Number(p.creditoFavor || 0), 0);
  const proximas = citasPaciente.filter((c) => ['pendiente', 'confirmada', 'en_espera'].includes(c.estado) && c.fecha >= fechaHoy()).sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));

  const recargarCuenta = async () => {
    if (!paciente?.id) return;
    setCargando(true);
    try {
      const [datosCuenta, datosDocs] = await Promise.all([
        api.getCuentaPaciente(paciente.id),
        api.getDocumentosPaciente(paciente.id)
      ]);
      setCuenta(datosCuenta || { movimientos: [], resumen: {} });
      setDocumentos(datosDocs || []);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !paciente) return;
    setPestana('resumen');
    recargarCuenta();
  }, [isOpen, paciente?.id]);

  if (!isOpen || !paciente) return null;

  const pedirOperacionPago = async (pago, tipo) => {
    const maximo = Number(pago.cobrado || 0);
    if (maximo <= 0) return;
    const resultado = await Swal.fire({
      title: tipo === 'anular' ? 'Anular pago registrado' : 'Registrar devolucion',
      html: `<div style="text-align:left;display:grid;gap:10px"><div>Disponible: <b>${moneda(maximo)}</b></div><input id="dp-op-monto" class="swal2-input" type="number" min="0.01" max="${maximo}" step="0.01" value="${maximo}" style="margin:0;width:100%"><textarea id="dp-op-motivo" class="swal2-textarea" placeholder="Motivo obligatorio" style="margin:0;width:100%"></textarea></div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: tipo === 'anular' ? 'Anular pago' : 'Registrar devolucion',
      cancelButtonText: 'Volver',
      background: '#1e293b',
      color: '#fff',
      preConfirm: () => {
        const monto = Number(document.getElementById('dp-op-monto')?.value || 0);
        const motivo = document.getElementById('dp-op-motivo')?.value?.trim() || '';
        if (monto <= 0 || monto > maximo) return Swal.showValidationMessage('Monto invalido.');
        if (!motivo) return Swal.showValidationMessage('El motivo es obligatorio.');
        return { monto, motivo };
      }
    });
    if (!resultado.isConfirmed) return;
    try {
      if (tipo === 'anular') await api.anularPago(pago.id, { ...resultado.value, usuario: 'Administrador' });
      else await api.devolverPago(pago.id, { ...resultado.value, usuario: 'Administrador' });
      await Promise.all([recargarCuenta(), onDatosActualizados?.()]);
      Swal.fire({ title: tipo === 'anular' ? 'Pago anulado' : 'Devolucion registrada', icon: 'success', background: '#1e293b', color: '#fff', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo completar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const registrarPago = async (pago) => {
    const saldo = Number(pago.saldo || 0);
    if (saldo <= 0) return;
    const resultado = await Swal.fire({
      title: 'Registrar pago',
      html: `<div style="text-align:left;display:grid;gap:10px"><div>Saldo: <b>${moneda(saldo)}</b></div><input id="dp-pago-monto" class="swal2-input" type="number" min="0.01" max="${saldo}" step="0.01" value="${saldo}" style="margin:0;width:100%"><select id="dp-pago-metodo" class="swal2-select" style="margin:0;width:100%"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select><input id="dp-pago-ref" class="swal2-input" placeholder="Referencia u operacion (opcional)" style="margin:0;width:100%"></div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar',
      background: '#1e293b',
      color: '#fff',
      preConfirm: () => ({ monto: Number(document.getElementById('dp-pago-monto')?.value || 0), metodo: document.getElementById('dp-pago-metodo')?.value || 'Efectivo', referencia: document.getElementById('dp-pago-ref')?.value || '', usuario: 'Administrador' })
    });
    if (!resultado.isConfirmed) return;
    try {
      await api.registrarPago(pago.id, resultado.value);
      await Promise.all([recargarCuenta(), onDatosActualizados?.()]);
      Swal.fire({ title: 'Pago registrado', icon: 'success', background: '#1e293b', color: '#fff', timer: 1600, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ title: 'No se pudo registrar', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const subirDocumento = async (event) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    try {
      await api.subirDocumentoPaciente(paciente.id, archivo, 'Documento clinico');
      await recargarCuenta();
    } catch (error) {
      Swal.fire({ title: 'No se pudo subir', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
    event.target.value = '';
  };

  const eliminarDocumento = async (documento) => {
    const confirmar = await Swal.fire({ title: `Eliminar ${documento.nombre}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Volver', background: '#1e293b', color: '#fff' });
    if (!confirmar.isConfirmed) return;
    await api.eliminarDocumentoPaciente(paciente.id, documento.id);
    recargarCuenta();
  };

  const abrirCronograma = (plan) => {
    const sesionesExistentes = citasPaciente.filter((c) => Number(c.planId) === Number(plan.id));
    setCronograma({
      plan,
      cantidad: Math.max(1, Number(plan.nSesiones || 1) - sesionesExistentes.length),
      fechaInicio: sumarDias(fechaHoy(), 1),
      hora: '09:00',
      intervaloDias: 30,
      duracion: 60,
      servicio: plan.nombre || 'Sesion de tratamiento',
      existentes: sesionesExistentes
    });
  };

  const generarSesiones = async () => {
    const datos = cronograma;
    if (!datos) return;
    const cantidad = Math.max(1, Number(datos.cantidad || 1));
    const existentes = datos.existentes || [];
    const totalNuevo = existentes.length + cantidad;
    try {
      for (const cita of existentes) {
        if (Number(cita.totalSesiones || 1) !== totalNuevo) await api.actualizarCita(cita.id, { ...cita, totalSesiones: totalNuevo });
      }
      let baseId = existentes.length ? Number(existentes[0].citaBaseId || existentes[0].id) : null;
      for (let indice = 0; indice < cantidad; indice += 1) {
        const numero = existentes.length + indice + 1;
        const respuesta = await api.crearCitaConPago({
          pacienteId: paciente.id,
          planId: datos.plan.id,
          citaBaseId: baseId,
          fecha: sumarDias(datos.fechaInicio, indice * Number(datos.intervaloDias || 0)),
          hora: datos.hora,
          horaFin: (() => { const [h, m] = datos.hora.split(':').map(Number); const t = h * 60 + m + Number(datos.duracion || 60); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; })(),
          duracionMinutos: Number(datos.duracion || 60),
          procedimiento: `${datos.servicio} - Sesion ${numero}`,
          servicios: [{ nombre: `${datos.servicio} - Sesion ${numero}`, costo: 0 }],
          costo: 0,
          tipoPago: 'sesion',
          montoPagado: 0,
          metodoPago: 'Pendiente',
          estado: 'pendiente',
          sesionNum: numero,
          totalSesiones: totalNuevo,
          notas: `Sesion ${numero} de ${totalNuevo}. Incluida en el plan de tratamiento.`
        });
        if (!baseId) baseId = respuesta?.cita?.id || null;
      }
      setCronograma(null);
      await onDatosActualizados?.();
      Swal.fire({ title: 'Cronograma creado', text: `${cantidad} sesion(es) agregadas a la agenda.`, icon: 'success', background: '#1e293b', color: '#fff' });
    } catch (error) {
      Swal.fire({ title: 'No se pudo crear el cronograma', text: error.message, icon: 'error', background: '#1e293b', color: '#fff' });
    }
  };

  const tabs = [
    ['resumen', 'Resumen', UserRound],
    ['atenciones', 'Atenciones', ClipboardList],
    ['tratamientos', 'Tratamientos y sesiones', CalendarPlus],
    ['cuenta', 'Cuenta y pagos', ReceiptText],
    ['documentos', 'Documentos', FolderOpen]
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md" onMouseDown={onClose}>
      <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-900 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-700 bg-slate-800/80 px-6 py-5">
          <div className="flex min-w-0 items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-2xl font-black text-cyan-300">{(paciente.nombre || '?').charAt(0)}</div><div className="min-w-0"><div className="text-xs font-bold uppercase tracking-widest text-cyan-400">Ficha integral del paciente</div><h2 className="truncate text-2xl font-black text-white">{paciente.nombre}</h2><div className="mt-1 text-xs text-slate-400">Ficha {paciente.codigo_ficha || 'SIN NUMERO'} · DNI {paciente.cedula || '—'} · {paciente.telefono || 'Sin telefono'}</div></div></div>
          <div className="flex items-center gap-2"><button type="button" onClick={recargarCuenta} className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-cyan-300"><RefreshCw size={18} className={cargando ? 'animate-spin' : ''} /></button><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-700 hover:text-white"><X size={21} /></button></div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-700 bg-slate-800/60 px-4 py-2">{tabs.map(([valor, texto, Icono]) => <button key={valor} type="button" onClick={() => setPestana(valor)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold ${pestana === valor ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}><Icono size={15} />{texto}</button>)}</nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          {pestana === 'resumen' && <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="text-xs font-bold uppercase text-cyan-400">Atenciones</div><div className="mt-2 text-3xl font-black text-white">{citasPaciente.length}</div></div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="text-xs font-bold uppercase text-emerald-400">Total pagado</div><div className="mt-2 text-2xl font-black text-white">{moneda(totalPagado)}</div></div><div className={`rounded-2xl border p-4 ${saldoPendiente > 0 ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}><div className="text-xs font-bold uppercase text-slate-400">Saldo</div><div className="mt-2 text-2xl font-black text-white">{saldoPendiente > 0 ? moneda(saldoPendiente) : 'Al dia'}</div></div><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="text-xs font-bold uppercase text-cyan-400">Credito a favor</div><div className="mt-2 text-2xl font-black text-white">{creditoFavor > 0 ? moneda(creditoFavor) : '—'}</div></div><div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="text-xs font-bold uppercase text-violet-400">Planes activos</div><div className="mt-2 text-3xl font-black text-white">{planesPaciente.filter((p) => p.estado !== 'completado').length}</div></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="text-xs font-bold uppercase text-amber-400">Proxima cita</div><div className="mt-2 font-black text-white">{proximas[0] ? `${proximas[0].fecha} ${proximas[0].hora}` : 'No programada'}</div></div></section>
            <section className="grid gap-3 md:grid-cols-2"><div className={`rounded-2xl border p-4 ${paciente.alergias ? 'border-rose-500/40 bg-rose-500/10' : 'border-slate-700 bg-slate-800/60'}`}><div className="flex items-center gap-2 text-xs font-black uppercase text-rose-300"><AlertTriangle size={16} />Alergias y antecedentes</div><div className="mt-2 text-sm text-slate-100">{paciente.alergias || 'Sin alertas registradas.'}</div></div><div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="text-xs font-black uppercase text-slate-400">Datos de contacto</div><div className="mt-2 text-sm text-white">{paciente.correo || 'Sin correo'}<br />{paciente.direccion || 'Sin direccion'}</div></div></section>
            <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><h3 className="mb-3 font-black text-white">Ultimas atenciones</h3><div className="space-y-2">{citasPaciente.slice(0, 5).map((c) => <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div><div className="text-xs text-slate-500">{c.fecha} · {c.hora}</div><div className="mt-1 font-bold text-white">{serviciosDeCita(c).map((s) => s.nombre).join(' + ')}</div></div><span className="text-xs font-bold text-cyan-300">{estadoTexto(c.estado)}</span></div>)}</div></section>
          </div>}

          {pestana === 'atenciones' && <div className="space-y-3">{citasPaciente.length ? citasPaciente.map((cita) => { const pago = pagosPaciente.find((p) => Number(p.citaId) === Number(cita.id)); return <article key={cita.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="text-xs font-semibold text-slate-500">{cita.fecha} · {cita.hora} - {cita.horaFin || '—'}</div><div className="mt-2 space-y-1">{serviciosDeCita(cita).map((s, i) => <div key={i} className="flex justify-between gap-4 text-sm"><span className="font-semibold text-white">{s.nombre}</span><span className="text-cyan-300">{moneda(s.costo)}</span></div>)}</div>{cita.notasFin && <div className="mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3 text-xs text-cyan-100">{cita.notasFin}</div>}</div><div className="min-w-[190px] rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs"><div className="flex justify-between"><span>Estado</span><b className="text-cyan-300">{estadoTexto(cita.estado)}</b></div><div className="mt-2 flex justify-between"><span>Total</span><b>{moneda(pago?.total ?? cita.costo)}</b></div><div className="mt-1 flex justify-between"><span>Pagado</span><b className="text-emerald-300">{moneda(pago?.cobrado)}</b></div><div className="mt-1 flex justify-between"><span>Saldo</span><b className="text-rose-300">{moneda(pago?.saldo)}</b></div></div></div></article>; }) : <div className="py-12 text-center text-slate-500">Sin atenciones registradas.</div>}</div>}

          {pestana === 'tratamientos' && <div className="space-y-4"><div className="flex justify-end"><button type="button" onClick={() => onCrearPlan?.(paciente)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white"><Plus size={15} />Crear plan de tratamiento</button></div>{planesPaciente.length ? planesPaciente.map((plan) => { const sesiones = citasPaciente.filter((c) => Number(c.planId) === Number(plan.id)).sort((a, b) => Number(a.sesionNum || 1) - Number(b.sesionNum || 1)); const completadas = sesiones.filter((c) => c.estado === 'completada').length; const planPago = planPagos.find((p) => Number(p.pacienteId) === Number(paciente.id) && String(p.concepto || '').toLowerCase().includes(String(plan.nombre || '').toLowerCase())); return <article key={plan.id} className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="text-lg font-black text-white">{plan.nombre}</h3><div className="mt-1 text-xs text-slate-400">{plan.descripcion || plan.tipo || 'Plan de tratamiento'}</div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-lg border border-violet-500/30 px-3 py-1 text-violet-300">{completadas} de {Math.max(Number(plan.nSesiones || 0), sesiones.length)} sesiones completadas</span><span className="rounded-lg border border-slate-700 px-3 py-1 text-slate-300">Costo acordado {moneda(plan.costo)}</span>{planPago && <span className="rounded-lg border border-rose-500/30 px-3 py-1 text-rose-300">Saldo {moneda(planPago.saldo)}</span>}</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => abrirCronograma(plan)} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white">{sesiones.length ? 'Agregar sesiones' : 'Generar cronograma'}</button><button type="button" onClick={() => onVerPlanPagos?.(paciente)} className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-bold text-slate-200"><WalletCards size={14} className="mr-1 inline" />Plan de pagos</button></div></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{sesiones.map((s) => <div key={s.id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"><div className="flex justify-between text-xs"><b className="text-cyan-300">Sesion {s.sesionNum || 1}</b><span className="text-slate-400">{estadoTexto(s.estado)}</span></div><div className="mt-1 text-sm font-semibold text-white">{s.fecha} · {s.hora}</div></div>)}</div></article>; }) : <div className="rounded-2xl border border-dashed border-slate-700 py-14 text-center text-slate-500">No hay planes de tratamiento. Crea uno y luego genera su cronograma de sesiones.</div>}</div>}

          {pestana === 'cuenta' && <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><div className="text-xs uppercase text-slate-500">Cargos</div><div className="mt-2 text-2xl font-black text-white">{moneda(cuenta.resumen?.cargos ?? pagosPaciente.reduce((s, p) => s + Number(p.total || 0), 0))}</div></div><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="text-xs uppercase text-emerald-400">Pagos netos</div><div className="mt-2 text-2xl font-black text-white">{moneda(cuenta.resumen?.abonos ?? totalPagado)}</div></div><div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4"><div className="text-xs uppercase text-rose-400">Saldo</div><div className="mt-2 text-2xl font-black text-white">{moneda(cuenta.resumen?.saldo ?? saldoPendiente)}</div></div><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="text-xs uppercase text-cyan-400">Credito a favor</div><div className="mt-2 text-2xl font-black text-white">{moneda(cuenta.resumen?.creditoFavor ?? creditoFavor)}</div></div></section><section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><h3 className="mb-3 flex items-center gap-2 font-black text-white"><History size={17} className="text-cyan-400" />Estado de cuenta</h3><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="text-slate-500"><tr><th className="p-2">Fecha</th><th className="p-2">Movimiento</th><th className="p-2 text-right">Cargo</th><th className="p-2 text-right">Abono</th><th className="p-2 text-right">Saldo</th></tr></thead><tbody className="divide-y divide-slate-700">{(cuenta.movimientos || []).map((m, i) => <tr key={`${m.tipo}-${m.id || i}`}><td className="p-2 text-slate-400">{m.fecha || '—'}</td><td className="p-2"><div className="font-semibold text-white">{m.descripcion}</div><div className="text-[10px] text-slate-500">{m.metodo || m.tipo}</div></td><td className="p-2 text-right text-rose-300">{Number(m.cargo || 0) ? moneda(m.cargo) : '—'}</td><td className="p-2 text-right text-emerald-300">{Number(m.abono || 0) ? moneda(m.abono) : '—'}</td><td className="p-2 text-right font-bold text-white">{moneda(m.saldoAcumulado)}</td></tr>)}</tbody></table></div></section><section className="space-y-2"><h3 className="font-black text-white">Cuentas por atencion</h3>{pagosPaciente.map((pago) => <div key={pago.id} className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3 md:flex-row md:items-center md:justify-between"><div><div className="font-bold text-white">{pago.concepto}</div><div className="mt-1 text-xs text-slate-400">Total {moneda(pago.total)} · Pagado {moneda(pago.cobrado)} · Saldo {moneda(pago.saldo)}</div></div><div className="flex flex-wrap gap-2">{pago.tipoPago === 'cuotas' ? <button type="button" onClick={() => onVerPlanPagos?.(paciente)} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white"><WalletCards size={13} />Gestionar cuotas</button> : <>{Number(pago.saldo || 0) > 0 && <button type="button" onClick={() => registrarPago(pago)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Registrar pago</button>}{Number(pago.cobrado || 0) > 0 && <><button type="button" onClick={() => pedirOperacionPago(pago, 'anular')} className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-300"><RotateCcw size={13} />Anular</button><button type="button" onClick={() => pedirOperacionPago(pago, 'devolver')} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-300">Devolver</button></>}</>}</div></div>)}</section></div>}

          {pestana === 'documentos' && <div className="space-y-4"><div className="flex justify-end"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white"><Upload size={15} />Subir documento<input type="file" className="hidden" onChange={subirDocumento} /></label></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{documentos.length ? documentos.map((doc) => <article key={doc.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4"><FileText size={24} className="text-cyan-400" /><div className="mt-3 truncate font-bold text-white">{doc.nombre}</div><div className="mt-1 text-xs text-slate-500">{doc.fecha || doc.creadoEn || 'Sin fecha'}</div><div className="mt-3 flex gap-2"><button type="button" onClick={() => api.descargarDocumentoPaciente(paciente.id, doc.id)} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white"><Download size={13} />Abrir</button><button type="button" onClick={() => eliminarDocumento(doc)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-rose-300"><Trash2 size={13} /></button></div></article>) : <div className="col-span-full rounded-2xl border border-dashed border-slate-700 py-14 text-center text-slate-500">Sin documentos. Puedes guardar radiografias, consentimientos, fotos y archivos clinicos.</div>}</div></div>}
        </main>

        <footer className="flex flex-col gap-3 border-t border-slate-700 bg-slate-800/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => onEditarPaciente?.(paciente)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-xs font-bold text-white"><Edit3 size={16} />Editar datos</button><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200">Cerrar</button><button type="button" onClick={() => onNuevaCita?.(paciente)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white"><CalendarPlus size={16} />Nueva atencion</button></div></footer>
      </div>

      {cronograma && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" onMouseDown={() => setCronograma(null)}><div className="w-full max-w-2xl rounded-2xl border border-violet-500/30 bg-slate-800 p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="flex justify-between"><div><h3 className="text-xl font-black text-white">Cronograma de sesiones</h3><p className="mt-1 text-xs text-slate-400">{cronograma.plan.nombre}</p></div><button type="button" onClick={() => setCronograma(null)} className="text-slate-400"><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-400">Sesiones a agregar<input type="number" min="1" value={cronograma.cantidad} onChange={(e) => setCronograma({ ...cronograma, cantidad: Number(e.target.value || 1) })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" /></label><label className="text-xs font-semibold text-slate-400">Primera fecha<input type="date" value={cronograma.fechaInicio} onChange={(e) => setCronograma({ ...cronograma, fechaInicio: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" /></label><label className="text-xs font-semibold text-slate-400">Hora<input type="time" value={cronograma.hora} onChange={(e) => setCronograma({ ...cronograma, hora: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" /></label><label className="text-xs font-semibold text-slate-400">Frecuencia (dias)<input type="number" min="1" value={cronograma.intervaloDias} onChange={(e) => setCronograma({ ...cronograma, intervaloDias: Number(e.target.value || 1) })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" /></label><label className="text-xs font-semibold text-slate-400">Duracion por sesion<input type="number" min="15" step="15" value={cronograma.duracion} onChange={(e) => setCronograma({ ...cronograma, duracion: Number(e.target.value || 60) })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" /></label><label className="text-xs font-semibold text-slate-400">Nombre de la sesion<input value={cronograma.servicio} onChange={(e) => setCronograma({ ...cronograma, servicio: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" /></label></div><div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">Las sesiones quedan vinculadas al plan clinico y se crean como incluidas en el tratamiento. El plan de pagos se administra por separado.</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCronograma(null)} className="rounded-xl border border-slate-600 px-4 py-2.5 text-xs font-bold text-slate-300">Cancelar</button><button type="button" onClick={generarSesiones} className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white">Crear sesiones</button></div></div></div>}
    </div>
  );
}
