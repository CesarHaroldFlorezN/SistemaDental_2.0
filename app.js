'use strict';
// ══════════════════════════════════════════
// CONEXIÓN A BASE DE DATOS EXTERNA (API FastAPI)
// ══════════════════════════════════════════
const API_URL = 'http://localhost:8000/api'; // Cambia esto en producción
const STORES  = ['pacientes','citas','pagos','planes','planPagos'];

async function initDB() {
  console.log("Conectando con el backend...");
  return Promise.resolve();
}

const dAll = async (store) => {
  try {
    const res = await fetch(`${API_URL}/${store}`);
    if (!res.ok) throw new Error('Error al obtener datos');
    return await res.json();
  } catch (error) {
    console.error(error);
    toast(`Error de conexión al obtener ${store}`, 'err');
    return [];
  }
};

const dAdd = async (store, data) => {
  try {
    const res = await fetch(`${API_URL}/${store}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al guardar');
    const obj = await res.json();
    return obj.id; // Crucial: devuelve el ID generado por la BD para que el resto del sistema funcione
  } catch (error) {
    console.error(error);
    toast('Error al guardar en la BD', 'err');
  }
};

const dPut = async (store, data) => {
  try {
    const res = await fetch(`${API_URL}/${store}/${data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar');
    return await res.json();
  } catch (error) {
    console.error(error);
    toast('Error al actualizar en la BD', 'err');
  }
};

const dDel = async (store, id) => {
  try {
    const res = await fetch(`${API_URL}/${store}/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar');
    return true;
  } catch (error) {
    console.error(error);
    toast('Error al eliminar en la BD', 'err');
  }
};

// ══════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════
async function exportarJSON() {
  const data = { v:1, ts: new Date().toISOString() };
  for (const s of STORES) data[s] = await dAll(s);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
  a.download = 'DentalPro_' + hoy() + '.json';
  a.click();
  toast('Exportación completa ✅');
}

function importarJSON() { document.getElementById('imp-file').click(); }

async function procesarImport(ev) {
  const file = ev.target.files[0]; if (!file) return;
  let data; try { data = JSON.parse(await file.text()); } catch { toast('Archivo inválido','err'); return; }

  const pacs = Array.isArray(data.pacientes) ? data.pacientes : Object.values(data.pacientes || {});
  if (!pacs.length) { toast('Formato incorrecto o vacío','err'); return; }

  if (!confirm('¿Importar ' + pacs.length + ' pacientes al servidor? Esto subirá los datos a la BD.')) {
    ev.target.value = '';
    return;
  }

  try {
    // Subida secuencial a la API (Idealmente se hace una ruta masiva en el backend, pero esto sirve para migrar)
    for (const s of STORES) {
      const registros = Array.isArray(data[s]) ? data[s] : Object.values(data[s] || {});
      for (const r of registros) {
        await fetch(`${API_URL}/${s}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(r)
        });
      }
    }
    toast('Importación al servidor exitosa ✅');
    setTimeout(() => location.reload(), 800);
  } catch(e) {
    console.error('Fallo en la inyección de datos:', e);
    toast('Error de red durante la importación', 'err');
  }
}

async function exportarFinanzasCSV() {
  const [pag, pac] = await Promise.all([dAll('pagos'), dAll('pacientes')]);
  const pm = Object.fromEntries(pac.map(p=>[p.id,p]));
  const rows = [['Paciente','DNI','Concepto','Fecha','Total','Cobrado','Saldo','Tipo','Método']];
  pag.forEach(g => { const p = pm[g.pacienteId]||{}; rows.push([p.nombre||'',p.cedula||'',g.concepto||'',g.fecha||'',g.total||0,g.cobrado||0,g.saldo||0,g.tipoPago||'',g.metodo||'']); });
  const csv = rows.map(r=>r.map(v=>'"'+v+'"').join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='Finanzas_'+hoy()+'.csv'; a.click();
  toast('CSV exportado ✅');
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
let pac_cache = [];
async function refreshCache() { pac_cache = await dAll('pacientes'); }

const hoy = () => new Date().toISOString().split('T')[0];
const mesActual = () => { const n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0'); };
const fDate = d => { if(!d) return '—'; const[y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; };
const fMon  = n => 'S/. ' + parseFloat(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const fmtM  = e => { let p=e.value.replace(/[^0-9.]/g,'').split('.'); p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,','); if(p.length>2)p.pop(); e.value=p.join('.'); };
const getNum = id => parseFloat((document.getElementById(id)?.value||'').replace(/,/g,''))||0;
const edad  = n => { if(!n)return'—'; const h=new Date(),b=new Date(n); let e=h.getFullYear()-b.getFullYear(); if(h.getMonth()<b.getMonth()||(h.getMonth()===b.getMonth()&&h.getDate()<b.getDate()))e--; return e+' años'; };
const addDays = (d,n) => { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().split('T')[0]; };

function aColor(nm) {
  const cs=['#00b4d8','#f4a261','#27ae60','#e74c3c','#8e44ad','#1abc9c','#e67e22','#2980b9'];
  let h=0; for (const c of (nm||'?')) h=c.charCodeAt(0)+((h<<5)-h);
  return cs[Math.abs(h)%cs.length];
}
const ini = n => n ? n.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() : '?';
function avt(nm, sz=28) {
  const bg=aColor(nm), fs=sz<26?9:11;
  return `<div class="av" style="width:${sz}px;height:${sz}px;background:${bg}22;color:${bg};border:1.5px solid ${bg}44;font-size:${fs}px">${ini(nm)}</div>`;
}
const eBadge = e => ({pendiente:'b-warn',en_atencion:'b-err',completada:'b-ok',cancelada:'b-gray'}[e]||'b-gray');
const eLabel = e => ({pendiente:'⏳ Pendiente',en_atencion:'🔴 En Atención',completada:'✅ Completada',cancelada:'❌ Cancelada'}[e]||e);

function toast(msg, type='ok') {
  const el = document.getElementById('toast');
  el.innerHTML = ({ok:'✅',err:'❌',warn:'⚠️'}[type]||'ℹ️') + ' ' + msg;
  el.className = 'show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}
function openM(id)  { document.getElementById(id).classList.add('on'); }
function closeM(id) { document.getElementById(id).classList.remove('on'); document.getElementById('acp').classList.remove('on'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.ovl.on').forEach(o=>o.classList.remove('on'));
    document.getElementById('acp').classList.remove('on');
  }
});
document.querySelectorAll('.ovl').forEach(o => o.addEventListener('click', e => {
  if (e.target === o) { o.classList.remove('on'); document.getElementById('acp').classList.remove('on'); }
}));

function clearQ(id, fn) { const el=document.getElementById(id); if(el){el.value='';el.focus();} fn(); }

// ══════════════════════════════════════════
// THEME
// ══════════════════════════════════════════
function toggleTheme() {
  const h = document.documentElement;
  const dark = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('tbtn').textContent = dark ? '🌙 Oscuro' : '☀️ Claro';
  localStorage.setItem('dp-theme', dark ? 'light' : 'dark');
}
(function(){
  const t = localStorage.getItem('dp-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tbtn').textContent = t==='light' ? '🌙 Oscuro' : '☀️ Claro';
  });
})();

// ══════════════════════════════════════════
// NAVEGACIÓN
// ══════════════════════════════════════════
let activePage = 'dashboard';
const pageConf = {
  dashboard: { title:'Dashboard',           btn:'＋ Nueva Cita',       act:()=>openNuevaCita() },
  pacientes: { title:'Pacientes',           btn:'＋ Nuevo Paciente',   act:()=>openNuevoPac() },
  citas:     { title:'Citas & Atención',    btn:'＋ Nueva Cita',       act:()=>openNuevaCita() },
  planes:    { title:'Planes Tratamiento',  btn:'＋ Nuevo Plan',       act:()=>openNuevoPlan() },
  finanzas:  { title:'Finanzas',            btn:'📊 CSV',              act:()=>exportarFinanzasCSV() },
  deudas:    { title:'Cuentas por Cobrar',  btn:'＋ Nueva Cita',       act:()=>openNuevaCita() },
  planpagos: { title:'Planes de Pago',      btn:'＋ Nuevo Plan de Pago', act:()=>openNuevoPP() },
};

document.querySelectorAll('.ni').forEach(n => n.addEventListener('click', () => goTo(n.dataset.page)));
document.getElementById('mbtn').addEventListener('click', () => pageConf[activePage]?.act?.());

function goTo(page) {
  if (!pageConf[page]) return;
  activePage = page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>{ n.classList.toggle('on', n.dataset.page===page); });
  const pg = document.getElementById('page-'+page);
  if (pg) pg.classList.add('on');
  document.getElementById('ptitle').textContent = pageConf[page].title;
  document.getElementById('mbtn').textContent   = pageConf[page].btn;
  renderPage(page);
}
function renderPage(p) {
  if (p==='dashboard')  renderDash();
  else if (p==='pacientes') renderPac();
  else if (p==='citas')     renderCitas();
  else if (p==='planes')    renderPlanes();
  else if (p==='finanzas')  renderFin();
  else if (p==='deudas')    renderDeudas();
  else if (p==='planpagos') renderPlanPagos();
}

// ══════════════════════════════════════════
// AUTOCOMPLETE
// ══════════════════════════════════════════
let _acInp=null, _acHid=null, _acCtx=null;
function acOpen(inpId, hidId, ctx) {
  _acInp=inpId; _acHid=hidId; _acCtx=ctx;
  const inp = document.getElementById(inpId);
  const q   = inp.value.trim().toLowerCase();
  const portal = document.getElementById('acp');
  if (!q) { portal.classList.remove('on'); return; }
  const terminos = q.split(/\s+/);
  const hits = pac_cache.filter(p => {
    const nom = p.nombre.toLowerCase(), ced = p.cedula || '', tel = p.telefono || '';
    return terminos.every(t => nom.includes(t) || ced.includes(t) || tel.includes(t));
  }).slice(0,8);
  portal.innerHTML = hits.length
    ? hits.map(p=>`<div class="aci" onmousedown="event.preventDefault();acPick(${p.id})"><strong>${p.nombre}</strong>${p.alergias?' ⚠️':''}<div class="aci-sub">${p.cedula?'DNI: '+p.cedula+' · ':''}${p.telefono||''}</div></div>`).join('')
    : `<div class="aci">Sin resultados. <a style="color:var(--teal);cursor:pointer" onmousedown="event.preventDefault();openNuevoPac()">+ Crear</a></div>`;
  const rect = inp.getBoundingClientRect();
  portal.style.cssText = `top:${rect.bottom+window.scrollY+2}px;left:${rect.left+window.scrollX}px;width:${Math.max(rect.width,250)}px`;
  portal.classList.add('on');
}
function acPick(id) {
  document.getElementById('acp').classList.remove('on');
  const p = pac_cache.find(x=>x.id===id); if (!p||!_acInp) return;
  document.getElementById(_acHid).value = id;
  document.getElementById(_acInp).style.display = 'none';
  // Show chip
  const prefix = _acCtx;
  const chip = document.getElementById(prefix+'-chip');
  if (chip) {
    chip.style.display = 'flex';
    document.getElementById(prefix+'-chip-name').textContent = p.nombre;
    document.getElementById(prefix+'-chip-sub').textContent  = (p.cedula?'DNI: '+p.cedula+' · ':'')+(p.telefono||'');
    const av = document.getElementById(prefix+'-chip-av');
    if (av) { av.style.cssText=`background:${aColor(p.nombre)}22;color:${aColor(p.nombre)};border:1.5px solid ${aColor(p.nombre)}44`; av.textContent=ini(p.nombre); }
    const ale = document.getElementById(prefix+'-ale');
    if (ale) { ale.style.display = p.alergias ? 'block' : 'none'; if(p.alergias){ const at=document.getElementById(prefix+'-ale-txt'); if(at)at.textContent=p.alergias; } }
  }
}
function acClear(prefix) {
  document.getElementById(prefix+'-id').value = '';
  const inp = document.getElementById(prefix+'-q'); if(inp){inp.value='';inp.style.display='';inp.focus();}
  const chip=document.getElementById(prefix+'-chip'); if(chip)chip.style.display='none';
  const ale=document.getElementById(prefix+'-ale'); if(ale)ale.style.display='none';
}
function acSetPac(prefix, p) {
  if (!p) return;
  document.getElementById(prefix+'-id').value = p.id;
  const inp = document.getElementById(prefix+'-q'); if(inp)inp.style.display='none';
  const chip = document.getElementById(prefix+'-chip');
  if (chip) {
    chip.style.display='flex';
    document.getElementById(prefix+'-chip-name').textContent=p.nombre;
    document.getElementById(prefix+'-chip-sub').textContent=(p.cedula?'DNI: '+p.cedula+' · ':'')+(p.telefono||'');
    const av=document.getElementById(prefix+'-chip-av'); if(av){av.style.cssText=`background:${aColor(p.nombre)}22;color:${aColor(p.nombre)};border:1.5px solid ${aColor(p.nombre)}44`;av.textContent=ini(p.nombre);}
    const ale=document.getElementById(prefix+'-ale'); if(ale){ale.style.display=p.alergias?'block':'none';const at=document.getElementById(prefix+'-ale-txt');if(at&&p.alergias)at.textContent=p.alergias;}
  }
}
document.addEventListener('click', e => { if(!e.target.closest('#acp')&&!e.target.closest('input[id$="-q"]')) document.getElementById('acp').classList.remove('on'); });

// ══════════════════════════════════════════
// PACIENTES
// ══════════════════════════════════════════
let editPacId = null;
function openNuevoPac(pid) {
  editPacId = pid||null;
  let p = {}; if(pid) p = pac_cache.find(x=>x.id===pid)||{};
  document.getElementById('mp-tit').textContent = pid ? '✏️ Editar Paciente' : '👤 Nuevo Paciente';
  document.getElementById('mp-body').innerHTML = `
    <div class="fgrid">
      <div class="fg"><label>ID de Ficha</label><input id="fp-cod" value="${p.codigo_ficha||''}" placeholder="Ej: F-001" style="font-weight:bold; color:var(--teal)"></div>
      <div class="fg"><label>DNI / Cédula</label><input id="fp-ced" value="${p.cedula||''}" placeholder="12345678"></div>
      
      <div class="fg full"><label>Nombre Completo *</label><input id="fp-nom" value="${p.nombre||''}" placeholder="María González"></div>
      
      <div class="fg"><label>Teléfono / WhatsApp</label><input id="fp-tel" value="${p.telefono||''}" placeholder="999 888 777"></div>
      <div class="fg"><label>Fecha Nacimiento</label><input id="fp-nac" type="date" value="${p.nacimiento||''}"></div>
      
      <div class="fg"><label>Género</label><select id="fp-gen"><option value="">—</option><option ${p.genero==='Masculino'?'selected':''}>Masculino</option><option ${p.genero==='Femenino'?'selected':''}>Femenino</option><option ${p.genero==='Otro'?'selected':''}>Otro</option></select></div>
      
      <div class="fg full"><label>Dirección</label><input id="fp-dir" value="${p.direccion||''}" placeholder="Av. Principal 123"></div>
      <div class="fg full"><label>⚠️ Alergias / Antecedentes</label><textarea id="fp-ale" placeholder="Ej: Alérgico a penicilina...">${p.alergias||''}</textarea></div>
      <div class="fg full"><label>Medicamentos Actuales</label><textarea id="fp-med" placeholder="Ej: Metformina 500mg...">${p.medicamentos||''}</textarea></div>
    </div>
    <div class="factions">
      <button class="btn btn-p" onclick="savePac()">💾 Guardar</button>
      <button class="btn btn-g" onclick="closeM('m-pac')">Cancelar</button>
    </div>`;
  openM('m-pac');
}
async function savePac() {
  const nom = document.getElementById('fp-nom').value.trim();
  const ced = document.getElementById('fp-ced').value.trim(); 
  const codFicha = document.getElementById('fp-cod').value.trim(); // Capturamos la ficha
  
  if (!nom) { toast('Nombre obligatorio', 'err'); return; }

  // 🛡️ VALIDACIÓN DE DNI DUPLICADO
  if (ced) {
    const existeDni = pac_cache.find(p => p.cedula === ced && p.id !== editPacId);
    if (existeDni) {
      toast(`Ese DNI ya está registrado a nombre de: ${existeDni.nombre}`, 'err');
      return; 
    }
  }

  // 🛡️ VALIDACIÓN DE FICHA DUPLICADA
  if (codFicha) {
    const existeFicha = pac_cache.find(p => p.codigo_ficha === codFicha && p.id !== editPacId);
    if (existeFicha) {
      toast(`La ficha ${codFicha} ya está asignada a: ${existeFicha.nombre}`, 'err');
      return; 
    }
  }

  // Si pasa la validación, armamos los datos (¡Completos!)
  const data = { 
    nombre: nom, 
    cedula: ced, 
    codigo_ficha: codFicha, 
    nacimiento: document.getElementById('fp-nac').value, 
    telefono: document.getElementById('fp-tel').value,
    genero: document.getElementById('fp-gen').value,
    direccion: document.getElementById('fp-dir').value,
    alergias: document.getElementById('fp-ale').value,
    medicamentos: document.getElementById('fp-med').value,
    fechaReg: hoy() 
  };
  
  if (editPacId) { 
    data.id = editPacId; 
    await dPut('pacientes', data); 
    toast('Paciente actualizado'); 
  } else { 
    await dAdd('pacientes', data); 
    toast('Paciente registrado ✅'); 
  }
  
  closeM('m-pac'); 
  await refreshCache(); 
  renderPac();
}
async function renderPac() {
  const [pacs, pagos, citas] = await Promise.all([dAll('pacientes'), dAll('pagos'), dAll('citas')]);
  const q = document.getElementById('q-pac')?.value.toLowerCase()||'';
  const deuMap={}, uvMap={};
  pagos.forEach(g=>{ const s=parseFloat(g.saldo||0); if(s>0) deuMap[g.pacienteId]=(deuMap[g.pacienteId]||0)+s; });
  citas.forEach(c=>{ if(c.estado==='completada'&&(!uvMap[c.pacienteId]||c.fecha>uvMap[c.pacienteId])) uvMap[c.pacienteId]=c.fecha; });
  const terminos = q.trim().split(/\s+/); // Separa la búsqueda por espacios
  const fil = pacs.filter(p => {
    if (!q.trim()) return true;
    const nom = p.nombre.toLowerCase();
    const ced = p.cedula || '';
    const tel = p.telefono || '';
    // Verifica que TODAS las palabras buscadas existan en el paciente
    return terminos.every(t => nom.includes(t) || ced.includes(t) || tel.includes(t));
  });
  document.getElementById('pac-cnt').textContent = fil.length + ' registro' + (fil.length!==1?'s':'');
  const tb = document.getElementById('tb-pac');
  if (!fil.length) { tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="ei">👥</div><p>Sin pacientes</p></div></td></tr>'; return; }
  tb.innerHTML = fil.map(p => {
    const d = deuMap[p.id]||0;
    return `<tr>
      <td><div class="pname">${avt(p.nombre,26)}<div><div style="font-size:12px;font-weight:600">${p.nombre}</div>${p.alergias?`<div style="font-size:10px;color:var(--err)">⚠️ ${p.alergias.slice(0,40)}</div>`:''}</div></div></td>
      <td>${p.cedula||'—'}</td><td>${p.telefono||'—'}</td><td>${edad(p.nacimiento)}</td>
      <td>${uvMap[p.id]?fDate(uvMap[p.id]):'<span class="t-gray">Sin visitas</span>'}</td>
      <td>${d>0?`<span class="fw7 t-err">${fMon(d)}</span>`:'<span class="t-ok">✓ Al día</span>'}</td>
      <td><div style="display:flex;gap:3px">
        <button class="btn btn-sm btn-g" onclick="verFicha(${p.id})">📋</button>
        <button class="btn btn-sm btn-g" onclick="openNuevoPac(${p.id})">✏️</button>
        <button class="btn btn-sm btn-err" onclick="delPac(${p.id})">🗑</button>
      </div></td></tr>`;
  }).join('');
}
async function delPac(id) { if(!confirm('¿Eliminar paciente?'))return; await dDel('pacientes',id); await refreshCache(); toast('Eliminado','warn'); renderPac(); }
async function verFicha(id) {
  const [pacs, citas, pagos] = await Promise.all([dAll('pacientes'),dAll('citas'),dAll('pagos')]);
  const p=pacs.find(x=>x.id===id)||{}; const pc=citas.filter(c=>c.pacienteId===id); const pp=pagos.filter(g=>g.pacienteId===id);
  const tPag=pp.reduce((a,g)=>a+parseFloat(g.cobrado||0),0), tDeu=pp.reduce((a,g)=>a+parseFloat(g.saldo||0),0);
  document.getElementById('mf-tit').textContent='📋 '+p.nombre;
  document.getElementById('mf-body').innerHTML=`
    <div class="fgrid" style="margin-bottom:13px">
      <div class="sec"><h4>Datos Personales</h4><div style="font-size:12px;display:flex;flex-direction:column;gap:4px">
       <div><span class="t-gray">Cod. Ficha:</span> <strong style="color:var(--teal)">${p.codigo_ficha||'—'}</strong></div>    <div><span class="t-gray">DNI:</span> ${p.cedula||'—'}</div><div><span class="t-gray">Nacimiento:</span> ${fDate(p.nacimiento)} (${edad(p.nacimiento)})</div>
        <div><span class="t-gray">Teléfono:</span> ${p.telefono||'—'}</div><div><span class="t-gray">Cód. Ficha:</span> <strong style="color:var(--teal)">${p.codigo_ficha||'—'}</strong></div>
      </div></div>
      <div class="sec"><h4>Historia Médica</h4>
        ${p.alergias?`<div style="background:rgba(231,76,60,.08);border:1px solid rgba(231,76,60,.2);border-radius:6px;padding:7px;color:var(--err);font-size:11px;margin-bottom:6px">⚠️ <strong>Alergias:</strong> ${p.alergias}</div>`:'<p style="font-size:11px;color:var(--tx2)">Sin alergias</p>'}
        ${p.medicamentos?`<p style="font-size:11px;color:var(--tx2);margin-top:4px"><strong>Medicamentos:</strong> ${p.medicamentos}</p>`:''}
      </div>
      <div class="sec"><h4>Estado de Cuenta</h4>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;justify-content:space-between"><span class="t-gray" style="font-size:11px">Total citas</span><span class="mono t-teal" style="font-size:18px">${pc.length}</span></div>
          <div style="display:flex;justify-content:space-between"><span class="t-gray" style="font-size:11px">Pagado</span><span class="mono t-ok" style="font-size:15px">${fMon(tPag)}</span></div>
          <div style="display:flex;justify-content:space-between"><span class="t-gray" style="font-size:11px">Saldo</span><span class="mono ${tDeu>0?'t-err':'t-ok'}" style="font-size:15px">${tDeu>0?fMon(tDeu):'✓ Al día'}</span></div>
        </div>
      </div>
    </div>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--tx2);margin-bottom:7px;font-weight:700">Últimas Citas</div>
    ${pc.length?pc.sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,5).map(c=>{
      const pg = pp.find(g => g.citaId === c.id);
      const saldo = pg ? parseFloat(pg.saldo || 0) : 0;
      let finBadge = '';
      if (saldo > 0) {
        if (pg.tipoPago === 'cuotas') {
           finBadge = `<span class="b b-warn" style="margin-right:4px">🗓️ En cuotas</span>`;
        } else {
           finBadge = `<span class="b b-err" style="margin-right:4px">⚠️ Debe ${fMon(saldo)}</span>`;
        }
      } else if (pg && parseFloat(pg.total) > 0 && saldo === 0) {
        finBadge = `<span class="b b-ok" style="margin-right:4px">💳 Pagado</span>`;
      }
      return `<div class="cc" style="padding:7px 10px"><div class="ctime"><div class="ct" style="font-size:11px">${c.hora||'—'}</div><div class="cd">${fDate(c.fecha)}</div></div>
        <div class="cinfo" style="flex:1"><div class="pn" style="font-size:12px">${c.procedimiento||'—'}</div></div>
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px">
          ${finBadge}
          <span class="b ${eBadge(c.estado)}">${eLabel(c.estado)}</span>
        </div>
      </div>`;
    }).join(''):'<p style="color:var(--tx2);font-size:12px">Sin citas registradas</p>'}
    <div class="factions"><button class="btn btn-p btn-sm" onclick="closeM('m-ficha');openNuevaCita(${p.id})">📅 Nueva Cita</button><button class="btn btn-g btn-sm" onclick="closeM('m-ficha');openNuevoPac(${p.id})">✏️ Editar</button></div>`;
  openM('m-ficha');
}

// ══════════════════════════════════════════
// NUEVA CITA
// ══════════════════════════════════════════
const PROCS = ['Consulta de evaluación','Limpieza dental','Empaste / Resina','Endodoncia (canal)','Extracción simple','Extracción muela juicio','Corona dental','Implante dental','Blanqueamiento','Ortodoncia — colocación','Ortodoncia — control','Prótesis dental','Rayos X','Cirugía oral','Otro'];
let ncPagoTipo = 'contado';
function getProcRowHTML(selVal) {
    const isOtro = selVal && !PROCS.includes(selVal) && selVal !== '';
    const mainVal = isOtro ? 'Otro' : selVal;
    return `<div class="proc-row" style="display:flex; gap:5px; margin-bottom:5px; align-items:flex-start">
      <div style="flex:1">
        <select class="proc-sel" onchange="this.nextElementSibling.style.display=this.value==='Otro'?'':'none'">
          <option value="">— Seleccionar —</option>
          ${PROCS.map(p=>`<option${mainVal===p?' selected':''}>${p}</option>`).join('')}
        </select>
        <input class="proc-otro" placeholder="Especificar..." value="${isOtro?selVal:''}" style="display:${isOtro?'':'none'}; margin-top:4px; width:100%">
      </div>
      <button class="btn btn-err btn-sm" onclick="this.closest('.proc-row').remove()" style="padding:6px 9px" title="Quitar">✕</button>
    </div>`;
}

function addProcRow(containerId) {
    document.getElementById(containerId).insertAdjacentHTML('beforeend', getProcRowHTML(''));
}

function getSelectedProcs(containerId) {
    const rows = document.querySelectorAll('#' + containerId + ' .proc-row');
    let procs = [];
    rows.forEach(r => {
        const sel = r.querySelector('.proc-sel').value;
        const otro = r.querySelector('.proc-otro').value.trim();
        const p = sel === 'Otro' ? otro : sel;
        if (p && p !== '— Seleccionar —') procs.push(p);
    });
    return procs.join(' + ');
}

function buildAcField(prefix, label) {
  return `<div class="fg full">
    <label>${label}</label>
    <input id="${prefix}-q" placeholder="🔍 Nombre, DNI o teléfono..." oninput="acOpen('${prefix}-q','${prefix}-id','${prefix}')" onfocus="acOpen('${prefix}-q','${prefix}-id','${prefix}')" autocomplete="off">
    <input type="hidden" id="${prefix}-id">
    <div id="${prefix}-chip" class="pac-chip" style="display:none">
      <div id="${prefix}-chip-av" class="av" style="width:30px;height:30px;font-size:11px">?</div>
      <div style="flex:1"><div class="chip-name" id="${prefix}-chip-name"></div><div class="chip-sub" id="${prefix}-chip-sub"></div></div>
      <button class="chip-x" onclick="acClear('${prefix}')">✕ cambiar</button>
    </div>
    <div id="${prefix}-ale" class="alg-box">⚠️ <strong>Alergia:</strong> <span id="${prefix}-ale-txt"></span></div>
  </div>`;
}

function buildProcSelect(selVal) {
  return `<select id="nc-proc" onchange="document.getElementById('nc-otro-w').style.display=this.value==='Otro'?'':'none'">
    <option value="">— Seleccionar —</option>
    ${PROCS.map(p=>`<option${selVal===p?' selected':''}>${p}</option>`).join('')}
  </select>`;
}

function openNuevaCita(pacId, planId) {
  ncPagoTipo = 'contado';
  const hor = new Date().toTimeString().slice(0,5);
  document.getElementById('mc-body').innerHTML = `<input type="hidden" id="nc-plan-id" value="${planId||''}">` + `
    <div class="sec hi">
      <h4><span class="stepn">1</span> Paciente</h4>
      ${buildAcField('nc','Buscar paciente')}
    </div>
    <div class="sec">
      <h4><span class="stepn">2</span> Datos de la Cita</h4>
      <div class="fgrid">
        <div class="fg"><label>Fecha *</label><input type="date" id="nc-fec" value="${hoy()}"></div>
        <div class="fg"><label>Hora *</label><input type="time" id="nc-hor" value="${hor}"></div>
        <div class="fg full">
        <label>Procedimientos *</label>
        <div id="nc-proc-list">${getProcRowHTML('')}</div>
        <button class="btn btn-sm btn-g" style="align-self:flex-start; margin-top:2px" onclick="addProcRow('nc-proc-list')">＋ Añadir otro procedimiento</button>
        </div>
        <div class="fg full"><label>Notas</label><textarea id="nc-not" placeholder="Síntomas, indicaciones..."></textarea></div>
      </div>
    </div>
    <div class="sec" id="nc-ses-sec">
      <h4><span class="stepn">3</span> Sesiones</h4>
      <div class="fgrid">
        <div class="fg"><label>Tipo</label>
          <select id="nc-rec-tipo" onchange="ncToggleSes()">
            <option value="unica">Sesión única</option>
            <option value="multiple">Múltiples sesiones</option>
          </select>
        </div>
        <div class="fg" id="nc-rec-n-w" style="display:none"><label>Total de sesiones</label><input type="number" id="nc-rec-n" placeholder="Ej: 3" min="2" max="30" oninput="ncGenSes()"></div>
        <div class="fg" id="nc-rec-int-w" style="display:none"><label>Intervalo</label>
          <select id="nc-rec-int" onchange="ncGenSes()">
            <option value="7">Semanal</option><option value="14">Quincenal</option><option value="30" selected>Mensual</option><option value="45">45 días</option><option value="60">Bimestral</option>
          </select>
        </div>
      </div>
      <div id="nc-ses-lista"></div>
    </div>
    
    
    <div class="sec">
      <h4><span class="stepn">4</span> Acuerdo de Pago</h4>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Define cómo y cuándo pagará el paciente. Puedes registrar un anticipo ahora y definir el resto después.</div>
      <div class="fgrid" style="margin-bottom:10px">
        <div class="fg"><label>Costo total (S/.)</label><input type="text" id="nc-cos" placeholder="0.00" onkeyup="fmtM(this)" oninput="ncRenderPago()"></div>
        <div class="fg"><label>Método cobro (si aplica hoy)</label>
          <select id="nc-met"><option value="">Sin cobro hoy</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select>
        </div>
      </div>
      <div id="nc-pago-wrap"><p style="font-size:11px;color:var(--tx2)">Ingresa el costo para configurar el pago.</p></div>
    </div>


    <div class="factions">
      <button class="btn btn-p" onclick="saveCita()">📅 Agendar Cita</button>
      <button class="btn btn-g" onclick="closeM('m-cita')">Cancelar</button>
    </div>`;
  openM('m-cita');
  if (pacId) { const p=pac_cache.find(x=>x.id===pacId); if(p) acSetPac('nc',p); }
}

function ncToggleSes() {
  const multi = document.getElementById('nc-rec-tipo').value === 'multiple';
  document.getElementById('nc-rec-n-w').style.display   = multi ? '' : 'none';
  document.getElementById('nc-rec-int-w').style.display = multi ? '' : 'none';
  if (!multi) document.getElementById('nc-ses-lista').innerHTML = '';
  else ncGenSes();
}
function ncGenSes() {
  const fec=document.getElementById('nc-fec').value, hor=document.getElementById('nc-hor').value;
  const n=parseInt(document.getElementById('nc-rec-n').value)||0;
  const int=parseInt(document.getElementById('nc-rec-int').value)||30;
  const proc = getSelectedProcs('nc-proc-list') || 'Sesión';
  const lista=document.getElementById('nc-ses-lista');
  if (!fec||n<2){lista.innerHTML='';return;}
  let html='<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--tx2);margin-bottom:6px">Edita fecha/hora de cada sesión:</div>';
  for(let i=0; i<n; i++){
    const fd=i===0?fec:addDays(fec,i*int);
    html+=`<div class="sesrow">
      <div class="sesnum">${i+1}</div>
      <div style="font-size:11px;font-weight:600">${i===0?proc+' (Principal)':'Sesión '+(i+1)+' de '+n}</div>
      <input type="date" id="ns-fec-${i}" value="${fd}">
      <input type="time" id="ns-hor-${i}" value="${hor||'09:00'}" style="max-width:90px">
      <span></span>
    </div>`;
  }
  lista.innerHTML=html;
}

function ncRenderPago() {
  const cos=getNum('nc-cos');
  const wrap=document.getElementById('nc-pago-wrap');
  if (!cos){wrap.innerHTML='<p style="font-size:11px;color:var(--tx2)">Ingresa el costo para configurar el pago.</p>';return;}
  wrap.innerHTML=buildPagoGrid('nc',cos,ncPagoTipo)+`<div id="nc-pago-det" style="margin-top:8px"></div><div id="nc-pago-res"></div>`;
  renderPagoDet('nc',cos);
}
function buildPagoGrid(pfx,cos,sel) {
  const opts=[
    {k:'contado',  ico:'💵', t:'Al finalizar',         d:`Paga ${fMon(cos)} cuando termine. Sin cobro hoy.`},
    {k:'completo', ico:'✅', t:'Pagado completo hoy',   d:`Registra ${fMon(cos)} como pagado ahora.`},
    {k:'anticipo', ico:'💳', t:'Anticipo ahora',         d:'Cobra un adelanto hoy, el resto al finalizar.'},
    {k:'cuotas',   ico:'📅', t:'Cuotas / Financiamiento',d:'Define fecha y monto de cada cuota.'},
  ];
  return `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--tx2);margin-bottom:8px">¿Cómo pagará el paciente?</div>
  <div class="pgrid">${opts.map(o=>`
    <div class="popt${sel===o.k?' on':''}" onclick="selPago('${pfx}','${o.k}',this,${cos})">
      <input type="radio" name="${pfx}-pt" ${sel===o.k?'checked':''}><div class="pb"><div class="pt">${o.ico} ${o.t}</div><div class="pd">${o.d}</div></div>
    </div>`).join('')}</div>`;
}
function selPago(pfx,tipo,el,cos) {
  if(pfx==='nc') ncPagoTipo=tipo;
  else if(pfx==='ec') ecPagoTipo=tipo;
  el.closest('.pgrid').querySelectorAll('.popt').forEach(o=>{ o.classList.remove('on'); const r=o.querySelector('input[type=radio]'); if(r)r.checked=false; });
  el.classList.add('on'); const r=el.querySelector('input[type=radio]'); if(r)r.checked=true;
  renderPagoDet(pfx,cos);
}
function renderPagoDet(pfx,cos) {
  const tipo = pfx==='nc'?ncPagoTipo:ecPagoTipo;
  const det=document.getElementById(pfx+'-pago-det');
  const res=document.getElementById(pfx+'-pago-res');
  if(!det||!res) return;
  if(tipo==='contado'){
    det.innerHTML='';
    res.innerHTML=`<div class="rpago"><div class="rrow"><span>Total</span><strong>${fMon(cos)}</strong></div><div class="rrow"><span>Cobrar hoy</span><strong class="t-gray">S/. 0.00</strong></div><div class="rrow tot"><span>Cobrar al finalizar</span><strong class="t-teal">${fMon(cos)}</strong></div></div>`;
  } else if(tipo==='completo'){
    det.innerHTML='';
    res.innerHTML=`<div class="rpago"><div class="rrow"><span>Total</span><strong>${fMon(cos)}</strong></div><div class="rrow tot"><span>✅ Cobrar ahora</span><strong class="t-ok">${fMon(cos)}</strong></div></div>`;
  } else if(tipo==='anticipo'){
    det.innerHTML=`<div class="fgrid"><div class="fg"><label>Anticipo a cobrar ahora (S/.)</label><input type="number" id="${pfx}-ant" placeholder="0.00" min="0" max="${cos}" step="0.01" oninput="calcAnt('${pfx}',${cos})"><div class="hint">Máximo: ${fMon(cos)}</div></div><div class="fg"><label>El resto se paga</label><select id="${pfx}-rst"><option value="fin">Al finalizar</option><option value="manual">Más adelante</option></select></div></div>`;
    res.innerHTML='';
  } else if(tipo==='cuotas'){
    if (pfx === 'ec' && window._ecCuotasActuales && window._ecCuotasActuales.length > 0) {
      det.innerHTML = `<div class="sec" style="border-color:var(--teal);background:var(--tbg);margin-top:8px"><h4 style="color:var(--teal)">📅 Plan de Pagos Activo</h4><div style="font-size:12px;color:var(--tx2)">Esta cita ya tiene un plan de ${window._ecCuotasActuales.length} cuotas configurado. Para cambiar las fechas o montos, ve a la sección <strong>Planes de Pago</strong>.</div></div>`;
      res.innerHTML = '';
    } else {
      det.innerHTML=`<div class="fgrid" style="margin-bottom:8px"><div class="fg"><label>Número de cuotas</label><input type="number" id="${pfx}-ncuo" placeholder="Ej: 3" min="2" max="36" oninput="genCuotas('${pfx}',${cos})"></div><div class="fg"><label>Intervalo</label><select id="${pfx}-icuo" onchange="genCuotas('${pfx}',${cos})"><option value="7">Semanal</option><option value="15">Quincenal</option><option value="30" selected>Mensual</option><option value="60">Bimestral</option></select></div></div><div id="${pfx}-ctab-wrap"></div>`;
      res.innerHTML='';
    }
  }
}
function calcAnt(pfx,cos){
  const ant=parseFloat(document.getElementById(pfx+'-ant')?.value)||0;
  const res=document.getElementById(pfx+'-pago-res');
  if(res) res.innerHTML=`<div class="rpago"><div class="rrow"><span>Total</span><strong>${fMon(cos)}</strong></div><div class="rrow"><span>✅ Anticipo</span><strong class="t-ok">${fMon(ant)}</strong></div><div class="rrow tot"><span>Pendiente</span><strong class="${Math.max(0,cos-ant)>0?'t-warn':'t-ok'}">${fMon(Math.max(0,cos-ant))}</strong></div></div>`;
}
function genCuotas(pfx,cos){
  const n=parseInt(document.getElementById(pfx+'-ncuo')?.value)||0;
  const int=parseInt(document.getElementById(pfx+'-icuo')?.value)||30;
  const wrap=document.getElementById(pfx+'-ctab-wrap');
  const res=document.getElementById(pfx+'-pago-res');
  if(!wrap||n<2) return;
  const m=(cos/n).toFixed(2);
  let html=`<table class="ctab"><thead><tr><th>#</th><th>Fecha de pago</th><th>Monto (S/.)</th></tr></thead><tbody>`;
  for(let i=0;i<n;i++){html+=`<tr><td><span class="b b-teal">${i+1}</span></td><td><input type="date" id="${pfx}-cfec-${i}" value="${addDays(hoy(),i*int)}"></td><td><input type="number" id="${pfx}-cmon-${i}" value="${m}" min="0" step="0.01"></td></tr>`;}
  html+=`</tbody></table>`;
  wrap.innerHTML=html;
  if(res) res.innerHTML=`<div class="rpago"><div class="rrow"><span>Total</span><strong>${fMon(cos)}</strong></div><div class="rrow tot"><span>${n} cuotas de</span><strong class="t-teal">${fMon(parseFloat(m))}</strong></div></div>`;
}
function getCuotas(pfx,n){
  const list=[];
  for(let i=0;i<n;i++) list.push({num:i+1,tipo:'cuota',fecha:document.getElementById(pfx+'-cfec-'+i)?.value||hoy(),monto:parseFloat(document.getElementById(pfx+'-cmon-'+i)?.value)||0,pagado:false,fechaPago:null,metodoPago:null});
  return list;
}
function getCobroInfo(pfx,cos){
  const tipo=pfx==='nc'?ncPagoTipo:ecPagoTipo;
  let cobrado=0,saldo=cos,cuotas=[];
  if(tipo==='completo'){cobrado=cos;saldo=0;}
  else if(tipo==='anticipo'){cobrado=parseFloat(document.getElementById(pfx+'-ant')?.value)||0;saldo=Math.max(0,cos-cobrado);}
  else if(tipo==='cuotas'){
    if (pfx === 'ec' && window._ecCuotasActuales && window._ecCuotasActuales.length > 0 && !document.getElementById(pfx+'-ncuo')) {
      cuotas = window._ecCuotasActuales;
    } else {
      const n=parseInt(document.getElementById(pfx+'-ncuo')?.value)||0; cuotas=getCuotas(pfx,n);
    }
    saldo=cos;
  }
  return {cobrado,saldo,cuotas,tipo};
}

async function saveCita() {
  const pacId=parseInt(document.getElementById('nc-id')?.value);
  const fec=document.getElementById('nc-fec')?.value;
  const hor=document.getElementById('nc-hor')?.value;
  const proc = getSelectedProcs('nc-proc-list');
  if(!pacId){toast('Selecciona un paciente','err');return;}
  if(!fec||!hor){toast('Fecha y hora obligatorias','err');return;}
 if(!proc){toast('Selecciona un procedimiento','err');return;}

  const cos=getNum('nc-cos');
  const met=document.getElementById('nc-met')?.value||'';
  const recTipo=document.getElementById('nc-rec-tipo')?.value||'unica';
  const recN=parseInt(document.getElementById('nc-rec-n')?.value)||0;
  const planId=parseInt(document.getElementById('nc-plan-id')?.value)||0;

  // Build sessions list
  const sesiones=[];
  if(recTipo==='multiple'&&recN>1){
    for(let i=0; i<recN; i++){
      const sf=document.getElementById('ns-fec-'+i)?.value||addDays(fec,i*30);
      const sh=document.getElementById('ns-hor-'+i)?.value||hor;
      sesiones.push({fecha:sf,hora:sh,num:i+1,total:recN});
    }
  } else { sesiones.push({fecha:fec,hora:hor,num:1,total:1}); }

  const {cobrado,saldo,cuotas,tipo:tipoPago}=getCobroInfo('nc',cos);

  // Create main cita
  const citaId=await dAdd('citas',{pacienteId:pacId,planId:planId,fecha:sesiones[0].fecha,hora:sesiones[0].hora,procedimiento:proc,notas:document.getElementById('nc-not')?.value?.trim()||'',costo:cos,tipoPago,estado:'pendiente',sesionNum:1,totalSesiones:sesiones.length,creadaEn:new Date().toISOString()});

  // Create pago record
  if(cos>0){
    const pagoId=await dAdd('pagos',{pacienteId:pacId,citaId,concepto:proc,fecha:fec,total:cos,cobrado,saldo,metodo:met||'—',tipoPago,cuotas,creadoEn:new Date().toISOString()});
    // If cuotas, also create planPago
    if(tipoPago==='cuotas'&&cuotas.length>0){
      await dAdd('planPagos',{pacienteId:pacId,pagoId,citaId,concepto:proc,totalAcordado:cos,anticipo:0,metodoPreferido:met||'',estado:'activo',cuotas,totalCuotas:cuotas.reduce((a,q)=>a+q.monto,0),cobrado:0,saldo:cos,fechaCreacion:fec,creadoEn:new Date().toISOString()});
    }
  }

  // Create additional sessions
  for(let i=1;i<sesiones.length;i++){
    await dAdd('citas',{pacienteId:pacId,planId:planId,fecha:sesiones[i].fecha,hora:sesiones[i].hora,procedimiento:proc+' — Sesión '+(i+1),notas:'Sesión '+(i+1)+' de '+sesiones.length,costo:0,tipoPago:'sesion',estado:'pendiente',sesionNum:i+1,totalSesiones:sesiones.length,citaBaseId:citaId,creadaEn:new Date().toISOString()});
  }

  closeM('m-cita');
  toast('✅ Cita agendada'+(sesiones.length>1?' — '+sesiones.length+' sesiones':''));
  renderPage(activePage); renderDash();
}

// ══════════════════════════════════════════
// CITAS & ATENCIÓN
// ══════════════════════════════════════════
let citaPil = 'todas';
function setPill(el,f){
  citaPil=f;
  document.querySelectorAll('#page-citas .pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  renderCitas();
}

function fechaLabel(d){
  const h=hoy(),m=addDays(h,1);
  if(d===h) return '<span style="color:var(--teal);font-weight:700">Hoy</span>';
  if(d===m) return '<span style="color:var(--warn)">Mañana</span>';
  return fDate(d);
}

async function renderCitas(){
  const [citas,pacs,pagos]=await Promise.all([dAll('citas'),dAll('pacientes'),dAll('pagos')]);
  const pm=Object.fromEntries(pacs.map(p=>[p.id,p]));
  const pgm=Object.fromEntries(pagos.map(g=>[g.citaId,g]));
  const q=(document.getElementById('q-cita')?.value||'').toLowerCase();
  const fd=document.getElementById('q-fecha')?.value||'';

  let lista=citaPil==='todas'?[...citas]:citas.filter(c=>c.estado===citaPil);
  if (q.trim()) {
    const terminos = q.trim().split(/\s+/);
    lista = lista.filter(c => {
      const p = pm[c.pacienteId] || {};
      const nomPac = (p.nombre || '').toLowerCase();
      const cedPac = (p.cedula || '').toLowerCase(); // <--- Capturamos el DNI / Cédula del paciente
      const proc = (c.procedimiento || '').toLowerCase();
      
      // Ahora valida que cada término esté en el nombre, en el DNI o en el procedimiento
      return terminos.every(t => nomPac.includes(t) || cedPac.includes(t) || proc.includes(t));
    });
  }

  if(fd) lista=lista.filter(c=>c.fecha===fd);

  // Smart sort
  if(citaPil==='pendiente'||citaPil==='en_atencion'){
    lista.sort((a,b)=>((a.fecha||'')+(a.hora||'')).localeCompare((b.fecha||'')+(b.hora||'')));
  } else if(citaPil==='todas'){
    const act=lista.filter(c=>c.estado==='pendiente'||c.estado==='en_atencion').sort((a,b)=>((a.fecha||'')+(a.hora||'')).localeCompare((b.fecha||'')+(b.hora||'')));
    const rest=lista.filter(c=>c.estado!=='pendiente'&&c.estado!=='en_atencion').sort((a,b)=>((b.fecha||'')+(b.hora||'')).localeCompare((a.fecha||'')+(a.hora||'')));
    lista=[...act,...rest];
  } else {
    lista.sort((a,b)=>((b.fecha||'')+(b.hora||'')).localeCompare((a.fecha||'')+(a.hora||'')));
  }

  const cont=document.getElementById('lista-citas');
  if(!lista.length){cont.innerHTML='<div class="empty"><div class="ei">📅</div><p>Sin citas en esta categoría</p></div>';return;}
  cont.innerHTML=lista.map(c=>{
    const p=pm[c.pacienteId]||{};
    const pg=pgm[c.id];
    const saldo=pg?parseFloat(pg.saldo||0):0;
    const tipoL={contado:'Contado',completo:'Pagado',anticipo:'Con anticipo',cuotas:'Cuotas',sesion:'Plan'}[c.tipoPago]||'';
    const esSes=c.totalSesiones>1;
    return `<div class="cc">
      <div class="ctime"><div class="ct">${c.hora||'—'}</div><div class="cd">${fechaLabel(c.fecha)}</div></div>
      <div class="cinfo" style="flex:1">
        <div class="pn">${avt(p.nombre||'?',24)} <span>${p.nombre||'Eliminado'}</span>
          ${esSes?`<span class="b b-purple" style="font-size:10px">Ses. ${c.sesionNum}/${c.totalSesiones}</span>`:''}
          ${tipoL&&!esSes?`<span class="b b-info" style="font-size:10px">${tipoL}</span>`:''}
        </div>
        <div class="tr">🩺 ${c.procedimiento||'—'}</div>
        <div class="meta">
          ${c.costo?`<span style="font-size:11px;color:var(--tx2)">Total: ${fMon(c.costo)}</span>`:''}
          ${saldo>0?`<span class="fw7 t-err" style="font-size:11px">💳 Saldo: ${fMon(saldo)}</span>`:''}
          ${pg&&parseFloat(pg.cobrado)>0&&saldo===0?`<span class="t-ok" style="font-size:11px">✅ Pagado</span>`:''}
          ${c.notas?`<span style="font-size:10px;color:var(--tx3)">📝 ${c.notas.slice(0,40)}</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
        <span class="b ${eBadge(c.estado)}">${eLabel(c.estado)}</span>
        <div class="cacts">
          ${c.estado==='pendiente'?`<button class="btn btn-sm btn-warn" onclick="iniciarAt(${c.id})">▶ Atender</button>`:''}
          ${c.estado==='en_atencion'?`<button class="btn btn-sm btn-ok" onclick="abrirCompletar(${c.id})">✓ Completar</button>`:''}
          ${c.estado==='completada'&&saldo>0?`<button class="btn btn-sm btn-p" onclick="abrirCobro(${c.id})">💳 Cobrar</button>`:''}
          ${c.estado==='pendiente'||c.estado==='en_atencion'?`<button class="btn btn-sm btn-info" onclick="editarCita(${c.id})">✏️</button>`:''}
          ${c.estado!=='cancelada'&&c.estado!=='completada'?`<button class="btn btn-sm btn-err" onclick="abrirCancelar(${c.id})">✕</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function iniciarAt(id){
  const citas=await dAll('citas');
  const c=citas.find(x=>x.id===id); if(!c)return;
  // Block if previous session not completed
  if(c.sesionNum>1&&c.totalSesiones>1){
    const baseId=c.citaBaseId||c.id;
    const grp=citas.filter(x=>x.id===baseId||x.citaBaseId===baseId).sort((a,b)=>a.sesionNum-b.sesionNum);
    const prev=grp.find(x=>x.sesionNum===c.sesionNum-1);
    if(prev&&prev.estado!=='completada'){toast('⛔ Debes completar la Sesión '+prev.sesionNum+' primero','err');return;}
  }
  c.estado='en_atencion';c.inicio=new Date().toISOString();
  await dPut('citas',c);toast('Atención iniciada 🔴','warn');renderCitas();renderDash();
}

// ══════════════════════════════════════════
// COMPLETAR ATENCIÓN
// ══════════════════════════════════════════
let cobrarOpt='cobrar';
async function abrirCompletar(citaId){
  const [citas,pacs,pagos]=await Promise.all([dAll('citas'),dAll('pacientes'),dAll('pagos')]);
  const c=citas.find(x=>x.id===citaId);if(!c)return;
  const p=pacs.find(x=>x.id===c.pacienteId)||{};
  const pg=pagos.find(g=>g.citaId===citaId);
  const saldo=pg?parseFloat(pg.saldo||0):(c.costo||0);
  const cobAnt=pg?parseFloat(pg.cobrado||0):0;
  const tpAct=pg?pg.tipoPago:'contado';
  const procsArr = (c.procedimiento||'').split(' + ');
  let procHTML = procsArr.map(p => getProcRowHTML(p)).join('');
  if(!procHTML) procHTML = getProcRowHTML('');




  document.getElementById('mco-tit').textContent='✅ Completar — '+p.nombre;
  let html=`<div class="cres">

  <div class="sec hi" style="border-color:var(--teal);margin-bottom:11px">
  <h4 style="color:var(--teal)">🛠️ Procedimientos Realizados</h4>
  <div id="co-proc-list">${procHTML}</div>
  <button class="btn btn-sm btn-g" style="margin-top:6px" onclick="addProcRow('co-proc-list')">＋ Añadir otro procedimiento</button>
  </div>
    <div class="crow"><span class="t-gray">Paciente</span><strong>${p.nombre}</strong></div>
    
    <div class="crow"><span class="t-gray">Fecha</span>${fDate(c.fecha)} ${c.hora||''}</div>
    <div class="crow"><span class="t-gray">Costo registrado</span>${fMon(c.costo)}</div>
    ${cobAnt>0?`<div class="crow"><span class="t-gray">Ya cobrado</span><span class="t-ok">${fMon(cobAnt)}</span></div>`:''}
    <div class="crow"><span class="t-gray">Saldo pendiente</span><span class="${saldo>0?'t-err fw7':'t-ok'}">${saldo>0?fMon(saldo):'✓ Sin saldo'}</span></div>
  </div>
  <div class="sec" style="border-color:rgba(243,156,18,.2);margin-bottom:11px">
    <h4 style="color:var(--warn)">⚙️ ¿El costo cambió?</h4>
    <div class="fgrid">
      <div class="fg"><label>Costo original</label><input type="number" id="co-orig" value="${c.costo||0}" disabled style="opacity:.5"></div>
      <div class="fg"><label>Costo final (edita si cambió)</label><input type="number" id="co-final" value="${c.costo||0}" min="0" step="0.01"></div>
    </div>
  </div>`;
  if(saldo>0){
    if(tpAct === 'cuotas') {
      cobrarOpt='mantener_cuotas';
      html+=`<div class="sec" style="border-color:var(--teal);background:var(--tbg);margin-bottom:11px">
        <h4 style="color:var(--teal)">📅 Financiamiento Activo</h4>
        <div style="font-size:12px;color:var(--tx2)">El saldo de ${fMon(saldo)} ya está financiado en cuotas. Se mantendrá el plan de pagos configurado.</div>
      </div>`;
    } else {
      cobrarOpt='cobrar';
      html+=`<div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--tx2);margin-bottom:8px">¿Qué hacer con el saldo de ${fMon(saldo)}?</div>
    <div class="copts">
      <div class="copt on" id="cop-cobrar" onclick="selCob('cobrar')"><div class="co-i">💵</div><div class="co-t">Cobrar ahora</div><div class="co-d">Paga hoy parcial o completo.</div></div>
      <div class="copt" id="cop-cuotas" onclick="selCob('cuotas')"><div class="co-i">📅</div><div class="co-t">Queda en cuotas</div><div class="co-d">Se financia en fechas acordadas.</div></div>
      <div class="copt" id="cop-pendiente" onclick="selCob('pendiente')"><div class="co-i">🕐</div><div class="co-t">Dejar pendiente</div><div class="co-d">Queda en cuentas por cobrar.</div></div>
      <div class="copt" id="cop-cortesia" onclick="selCob('cortesia')"><div class="co-i">🎁</div><div class="co-t">Cortesía</div><div class="co-d">Se condona el saldo.</div></div>
    </div>
    <div id="cob-det" style="margin-top:8px"></div>`;
        setTimeout(()=>selCob('cobrar'),20);
        }
      } else {
        html+=`<div class="sec" style="border-color:rgba(39,174,96,.3);text-align:center;padding:14px"><div style="font-size:26px">✅</div><div style="font-weight:700;color:var(--ok);margin-top:4px">Cita completamente pagada</div></div>`;
      }
  html+=`<div class="divider"></div><div class="fg"><label>Indicaciones post-tratamiento</label><textarea id="co-not" placeholder="Ej: Evitar alimentos duros 24h..."></textarea></div>
  <div class="factions"><button class="btn btn-p" onclick="guardarCompletado(${citaId},${pg?pg.id:0},${saldo})">✅ Completar</button><button class="btn btn-g" onclick="closeM('m-comp')">Cancelar</button></div>`;
  document.getElementById('mco-body').innerHTML=html;
  openM('m-comp');
}
function selCob(opt){
  cobrarOpt=opt;
  ['cobrar','cuotas','pendiente','cortesia'].forEach(o=>{document.getElementById('cop-'+o)?.classList.toggle('on',o===opt);});
  const det=document.getElementById('cob-det');if(!det)return;
  if(opt==='cobrar') det.innerHTML=`<div class="fgrid"><div class="fg"><label>Monto a cobrar (S/.)</label><input type="number" id="cob-m" placeholder="0.00" min="0" step="0.01"></div><div class="fg"><label>Método</label><select id="cob-met"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select></div></div>`;
  else if(opt==='cuotas') det.innerHTML=`<div class="fgrid" style="margin-bottom:8px"><div class="fg"><label>Número de cuotas</label><input type="number" id="cob-ncuo" placeholder="Ej: 3" min="2" max="24" oninput="genCobCuotas()"></div><div class="fg"><label>Intervalo</label><select id="cob-icuo" onchange="genCobCuotas()"><option value="7">Semanal</option><option value="15">Quincenal</option><option value="30" selected>Mensual</option></select></div></div><div id="cob-ctab"></div>`;
  else det.innerHTML='';
}
function genCobCuotas(){
  const n=parseInt(document.getElementById('cob-ncuo')?.value)||0;
  const int=parseInt(document.getElementById('cob-icuo')?.value)||30;
  const w=document.getElementById('cob-ctab');if(!w||n<2)return;
  const saldoEl=document.querySelector('.crow .t-err.fw7');
  const saldo=saldoEl?parseFloat(saldoEl.textContent.replace(/[^0-9.]/g,''))||0:0;
  const m=(saldo/n).toFixed(2);
  let html=`<table class="ctab"><thead><tr><th>#</th><th>Fecha</th><th>Monto (S/.)</th></tr></thead><tbody>`;
  for(let i=0;i<n;i++) html+=`<tr><td><span class="b b-teal">${i+1}</span></td><td><input type="date" id="cob-cfec-${i}" value="${addDays(hoy(),i*int)}"></td><td><input type="number" id="cob-cmon-${i}" value="${m}" min="0" step="0.01"></td></tr>`;
  w.innerHTML=html+'</tbody></table>';
}
async function guardarCompletado(citaId,pagoId,saldo){
  const [citas,pagos]=await Promise.all([dAll('citas'),dAll('pagos')]);
  const c=citas.find(x=>x.id===citaId);if(!c)return;
  // Cost adjustment
  const costoFinal=parseFloat(document.getElementById('co-final')?.value)||c.costo||0;
  const costoDiff=costoFinal-(c.costo||0);
  const procFinal = getSelectedProcs('co-proc-list');
  if (procFinal) c.procedimiento = procFinal;

  if(Math.abs(costoDiff)>0.001){
    c.costo=costoFinal;
    saldo=Math.max(0,saldo+costoDiff);
    if(pagoId){const pg=pagos.find(x=>x.id===pagoId);if(pg){pg.total=costoFinal;pg.saldo=saldo;pg.concepto=c.procedimiento;await dPut('pagos',pg);}}
  }
  c.estado='completada';c.fin=new Date().toISOString();c.notasFin=document.getElementById('co-not')?.value||'';
  await dPut('citas',c);
  const pg=pagoId?pagos.find(x=>x.id===pagoId):null;
  if(saldo>0){
    if(cobrarOpt==='mantener_cuotas'){
      // El plan ya existe, el sistema lo protege y no hace nada extra.
    } else if(cobrarOpt==='cobrar'){
      const mon=parseFloat(document.getElementById('cob-m')?.value)||0;
      const met=document.getElementById('cob-met')?.value||'';
      if(pg){pg.cobrado=parseFloat(pg.cobrado||0)+mon;pg.saldo=Math.max(0,parseFloat(pg.total||0)-pg.cobrado);pg.metodo=met;pg.fechaUltPago=hoy();await dPut('pagos',pg);}
      else if(costoFinal>0) await dAdd('pagos',{pacienteId:c.pacienteId,citaId,concepto:c.procedimiento,fecha:hoy(),total:costoFinal,cobrado:mon,saldo:Math.max(0,costoFinal-mon),metodo:met,tipoPago:'contado',fechaUltPago:hoy(),cuotas:[],creadoEn:new Date().toISOString()});
    } else if(cobrarOpt==='cuotas'){
      const n=parseInt(document.getElementById('cob-ncuo')?.value)||0;
      const cuotas=[];for(let i=0;i<n;i++)cuotas.push({num:i+1,tipo:'cuota',fecha:document.getElementById('cob-cfec-'+i)?.value||hoy(),monto:parseFloat(document.getElementById('cob-cmon-'+i)?.value)||0,pagado:false,fechaPago:null,metodoPago:null});
      if(pg){pg.tipoPago='cuotas';pg.cuotas=cuotas;await dPut('pagos',pg);}
      if(cuotas.length>0) await dAdd('planPagos',{pacienteId:c.pacienteId,pagoId:pagoId||0,citaId,concepto:c.procedimiento,totalAcordado:costoFinal,anticipo:0,metodoPreferido:'',estado:'activo',cuotas,totalCuotas:cuotas.reduce((a,q)=>a+q.monto,0),cobrado:0,saldo:costoFinal,fechaCreacion:hoy(),creadoEn:new Date().toISOString()});
    } else if(cobrarOpt==='cortesia'){
      if(pg){pg.saldo=0;pg.cobrado=pg.total;pg.tipoPago='cortesia';pg.nota='Condonado al finalizar';await dPut('pagos',pg);}
    }
  }
  closeM('m-comp');toast('Atención completada ✅');renderCitas();renderDash();
}

// ══════════════════════════════════════════
// CANCELAR
// ══════════════════════════════════════════
async function abrirCancelar(citaId){
  const [citas,pacs,pagos]=await Promise.all([dAll('citas'),dAll('pacientes'),dAll('pagos')]);
  const c=citas.find(x=>x.id===citaId);if(!c)return;
  const p=pacs.find(x=>x.id===c.pacienteId)||{};
  const pg=pagos.find(g=>g.citaId===citaId);
  const cob=pg?parseFloat(pg.cobrado||0):0;
  let html=`<div class="cres" style="margin-bottom:11px"><div class="crow"><span class="t-gray">Paciente</span><strong>${p.nombre}</strong></div><div class="crow"><span class="t-gray">Procedimiento</span>${c.procedimiento||'—'}</div><div class="crow"><span class="t-gray">Fecha</span>${fDate(c.fecha)} ${c.hora||''}</div></div>`;
  if(cob>0){
    html+=`<div style="background:rgba(243,156,18,.08);border:1px solid rgba(243,156,18,.25);border-radius:7px;padding:9px 12px;margin-bottom:10px;font-size:12px"><strong>Se pagó un anticipo de ${fMon(cob)}.</strong> ¿Qué se hace?</div>`;
    ['total_dev','credito','retener'].forEach((v,i)=>{
      const labs=['Devolver todo ('+fMon(cob)+')','Dejar como crédito a favor','Retener (cargo por cancelación)'];
      html+=`<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:7px;border:1px solid var(--bdr);margin-bottom:6px;cursor:pointer;font-size:12px"><input type="radio" name="dev" value="${v}" ${i===0?'checked':''} style="accent-color:var(--teal)"><span>${labs[i]}</span></label>`;
    });
  }
  html+=`<div class="fg" style="margin-bottom:11px"><label>Motivo de cancelación</label><textarea id="can-mot" placeholder="Ej: Paciente reagendó..."></textarea></div>
  <div class="factions"><button class="btn btn-err" onclick="confirmarCancelar(${citaId},${pg?pg.id:0},${cob})">❌ Confirmar</button><button class="btn btn-g" onclick="closeM('m-cancel')">Volver</button></div>`;
  document.getElementById('mca-body').innerHTML=html;openM('m-cancel');
}
async function confirmarCancelar(citaId,pagoId,cob){
  const devOpt=document.querySelector('input[name="dev"]:checked')?.value||'retener';
  const [citas,pagos]=await Promise.all([dAll('citas'),dAll('pagos')]);
  const c=citas.find(x=>x.id===citaId);if(!c)return;
  c.estado='cancelada';c.motivoCancelacion=document.getElementById('can-mot')?.value||'';c.canceladaEn=new Date().toISOString();
  await dPut('citas',c);
  if(pagoId&&cob>0){
    const pg=pagos.find(x=>x.id===pagoId);if(pg){
      if(devOpt==='total_dev'){pg.cobrado=0;pg.saldo=0;pg.devuelto=cob;pg.nota='Devuelto por cancelación';}
      else if(devOpt==='credito'){pg.creditoFavor=cob;pg.saldo=0;pg.nota='Crédito a favor';}
      pg.tipoPago='cancelado_'+devOpt;await dPut('pagos',pg);
    }
  }
  closeM('m-cancel');toast('Cita cancelada','warn');renderCitas();renderDash();
}

// ══════════════════════════════════════════
// COBRO RÁPIDO
// ══════════════════════════════════════════
async function abrirCobro(citaId){
  const [citas,pacs,pagos]=await Promise.all([dAll('citas'),dAll('pacientes'),dAll('pagos')]);
  const c=citas.find(x=>x.id===citaId);if(!c)return;
  const p=pacs.find(x=>x.id===c.pacienteId)||{};
  const pg=pagos.find(g=>g.citaId===citaId);if(!pg)return;
  document.getElementById('mcob-tit').textContent='💳 Cobrar — '+p.nombre;
  document.getElementById('mcob-body').innerHTML=`
    <div class="cres" style="margin-bottom:11px">
      <div class="crow"><span class="t-gray">Concepto</span><strong>${pg.concepto}</strong></div>
      <div class="crow"><span class="t-gray">Total</span>${fMon(pg.total)}</div>
      <div class="crow"><span class="t-gray">Ya cobrado</span><span class="t-ok">${fMon(pg.cobrado)}</span></div>
      <div class="crow"><span class="t-gray">Saldo</span><span class="t-err fw7">${fMon(pg.saldo)}</span></div>
    </div>
    <div class="fgrid">
      <div class="fg"><label>Monto a cobrar (S/.)</label><input type="number" id="rcob-m" value="${pg.saldo}" min="0" step="0.01"></div>
      <div class="fg"><label>Método</label><select id="rcob-met"><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select></div>
    </div>
    <div class="factions"><button class="btn btn-p" onclick="regCobro(${pg.id})">💳 Registrar</button><button class="btn btn-g" onclick="closeM('m-cobro')">Cancelar</button></div>`;
  openM('m-cobro');
}
async function regCobro(pgId){
  const pagos=await dAll('pagos');const pg=pagos.find(x=>x.id===pgId);if(!pg)return;
  const mon=parseFloat(document.getElementById('rcob-m')?.value)||0;
  pg.cobrado=parseFloat(pg.cobrado||0)+mon;pg.saldo=Math.max(0,parseFloat(pg.total||0)-pg.cobrado);
  
  // Si la deuda se pagó por completo, cambiamos su estado interno
  if (pg.saldo === 0 && pg.tipoPago !== 'cuotas') {
      pg.tipoPago = 'completo';
  }
  
  pg.metodo=document.getElementById('rcob-met')?.value||'';pg.fechaUltPago=hoy();
  await dPut('pagos',pg);
  closeM('m-cobro');
  toast('Cobro registrado ✅');
  
  // Refresca la pantalla actual (sea Deudas, Finanzas o Citas) al instante
  renderPage(activePage); 
  renderDash();
}

// ══════════════════════════════════════════
// EDITAR CITA
// ══════════════════════════════════════════
let ecPagoTipo='contado';
async function editarCita(citaId){
  const [citas,pacs,pagos]=await Promise.all([dAll('citas'),dAll('pacientes'),dAll('pagos')]);
  const c=citas.find(x=>x.id===citaId);if(!c)return;
  const p=pacs.find(x=>x.id===c.pacienteId)||{};
  const pg=pagos.find(g=>g.citaId===citaId);
  const baseId=c.citaBaseId||c.id;
  const grp=citas.filter(x=>x.id===baseId||x.citaBaseId===baseId).sort((a,b)=>a.sesionNum-b.sesionNum);
  const cosA=c.costo||0,cobA=pg?parseFloat(pg.cobrado||0):0,salA=pg?parseFloat(pg.saldo||0):cosA;
  const tpA=(pg?pg.tipoPago:c.tipoPago)||'contado';
  ecPagoTipo=['contado','completo','anticipo','cuotas'].includes(tpA)?tpA:'contado';
  window._ecCuotasActuales = pg ? (pg.cuotas||[]) : [];
  const tipoL={contado:'Al finalizar',completo:'Pagado',anticipo:'Con anticipo',cuotas:'Cuotas',sesion:'Sesión'};

  let sesHtml='';
  if(grp.length>1){
    sesHtml=`<div class="sec" style="border-color:rgba(142,68,173,.25);margin-bottom:11px"><h4 style="color:var(--purple)">📋 Sesiones del tratamiento (${grp.length} total)</h4>
    <div style="font-size:11px;color:var(--tx2);margin-bottom:8px">Las sesiones completadas o en atención no se pueden mover.</div>`;
    grp.forEach(s=>{
      const locked=s.estado==='completada'||s.estado==='en_atencion';
      const cur=s.id===citaId;
      sesHtml+=`<div class="sesrow" style="border:1.5px solid ${cur?'var(--teal)':'var(--bdr)'};background:${cur?'var(--tbg)':'var(--s2)'}">
            <div class="sesnum" style="${cur?'background:var(--teal);color:#fff':''}">${s.sesionNum}</div>
            <div style="font-size:11px;font-weight:600">${cur?'✏️ Esta sesión':'Ses. '+s.sesionNum+'/'+s.totalSesiones}</div>
            <input type="date" id="es-fec-${s.id}" value="${s.fecha||''}" ${locked?'disabled style="opacity:.5"':''} ${cur?`oninput="const e=document.getElementById('ec-fec');if(e)e.value=this.value;"`:''}> 
            <input type="time" id="es-hor-${s.id}" value="${s.hora||''}" style="max-width:88px" ${locked?'disabled style="opacity:.5"':''} ${cur?`oninput="const e=document.getElementById('ec-hor');if(e)e.value=this.value;"`:''}>
            <span class="b ${eBadge(s.estado)}" style="font-size:10px">${eLabel(s.estado)}</span>
      </div>`;
    });
    sesHtml+='</div>';
  }

  const sesIds=JSON.stringify(grp.map(s=>s.id));
  const procsArr = (c.procedimiento||'').split(' + ');
  let procHTML = procsArr.map(p => getProcRowHTML(p)).join('');
  if(!procHTML) procHTML = getProcRowHTML('');



  document.getElementById('me-body').innerHTML=`
    <div class="cres" style="margin-bottom:12px">
      <div class="crow"><span class="t-gray">Paciente</span><strong>${p.nombre}</strong></div>
      <div class="crow"><span class="t-gray">Estado</span><span class="b ${eBadge(c.estado)}">${eLabel(c.estado)}</span></div>
      ${pg?`<div class="crow"><span class="t-gray">Modalidad actual</span><strong>${tipoL[tpA]||tpA}</strong></div>
      <div class="crow"><span class="t-gray">Cobrado</span><span class="t-ok">${fMon(cobA)}</span></div>
      <div class="crow"><span class="t-gray">Saldo</span><span class="${salA>0?'t-err fw7':'t-ok'}">${salA>0?fMon(salA):'✓ Pagado'}</span></div>`:''}
    </div>
 <div class="sec hi" style="margin-bottom:11px"><h4><span class="stepn">1</span> Datos</h4>
      <div class="fgrid">
        <div class="fg"><label>Fecha *</label><input type="date" id="ec-fec" value="${c.fecha||''}" oninput="const e=document.getElementById('es-fec-${c.id}');if(e)e.value=this.value;"></div>
        <div class="fg"><label>Hora *</label><input type="time" id="ec-hor" value="${c.hora||''}" oninput="const e=document.getElementById('es-hor-${c.id}');if(e)e.value=this.value;"></div>
        
        <div class="fg full">
        <label>Procedimientos</label>
        <div id="ec-proc-list">${procHTML}</div>
        <button class="btn btn-sm btn-g" style="align-self:flex-start; margin-top:2px" onclick="addProcRow('ec-proc-list')">＋ Añadir otro procedimiento</button>
        </div>
        <div class="fg full"><label>Notas</label><textarea id="ec-notas">${c.notas||''}</textarea></div>
      </div>
    </div>
    ${sesHtml}
    <div class="sec" style="margin-bottom:11px"><h4><span class="stepn">2</span> Costo y Pago</h4>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:9px">Cambia la modalidad sin esperar a que el paciente llegue.</div>
      <div class="fgrid" style="margin-bottom:10px">
        <div class="fg"><label>Costo total (S/.)</label><input type="text" id="ec-costo" value="${cosA ? fMon(cosA).replace('S/. ','') : ''}" onkeyup="fmtM(this)" oninput="ecRefreshPago()"></div>
        <div class="fg"><label>Método cobro (si aplica hoy)</label>
          <select id="ec-met"><option value="">Sin cobro</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select>
        </div>
      </div>
      <div id="ec-pago-wrap"></div>
    </div>
    <div class="factions">
      <button class="btn btn-p" onclick="guardarEditCita(${citaId},${sesIds})">💾 Guardar</button>
      <button class="btn btn-g" onclick="closeM('m-edit')">Cancelar</button>
    </div>`;
  openM('m-edit');
  ecRefreshPago();
}
function ecRefreshPago(){
  const cos=parseFloat(document.getElementById('ec-costo')?.value)||0;
  const w=document.getElementById('ec-pago-wrap');if(!w)return;
  if(!cos){w.innerHTML='<p style="font-size:11px;color:var(--tx2)">Ingresa el costo para ver opciones de pago.</p>';return;}
  w.innerHTML=buildPagoGrid('ec',cos,ecPagoTipo)+`<div id="ec-pago-det" style="margin-top:8px"></div><div id="ec-pago-res"></div>`;
  renderPagoDet('ec',cos);
}
async function guardarEditCita(citaId,sesIds){
  const [citas,pagos]=await Promise.all([dAll('citas'),dAll('pagos')]);
  const c=citas.find(x=>x.id===citaId);if(!c)return;
  const fec=document.getElementById('ec-fec')?.value||c.fecha;
  const hor=document.getElementById('ec-hor')?.value||c.hora;
  const proc = getSelectedProcs('ec-proc-list');
  if (proc) c.procedimiento = proc;
  const costoNuevo=parseFloat(document.getElementById('ec-costo')?.value)||0;
  const met=document.getElementById('ec-met')?.value||'';
  if(!fec||!hor){toast('Fecha y hora obligatorias','err');return;}
  c.fecha=fec;c.hora=hor;c.procedimiento=proc||c.procedimiento;c.costo=costoNuevo;c.notas=document.getElementById('ec-notas')?.value||'';c.tipoPago=ecPagoTipo;
  await dPut('citas',c);
  // Save other sessions
  if(Array.isArray(sesIds)){
    for(const sid of sesIds){
      if(sid===citaId)continue;
      const s=citas.find(x=>x.id===sid);
      if(!s||s.estado==='completada'||s.estado==='en_atencion')continue;
      const nf=document.getElementById('es-fec-'+sid)?.value;
      const nh=document.getElementById('es-hor-'+sid)?.value;
      if(nf)s.fecha=nf;if(nh)s.hora=nh;
      await dPut('citas',s);
    }
  }
  // Update pago
  const {cobrado:nc,saldo:ns,cuotas:ncu,tipo:nt}=getCobroInfo('ec',costoNuevo);
  const pg=pagos.find(g=>g.citaId===citaId);
  if(pg){
    const yaC=parseFloat(pg.cobrado||0);
    pg.total=costoNuevo;pg.tipoPago=ecPagoTipo;if(met)pg.metodo=met;pg.concepto=c.procedimiento;
    if(ecPagoTipo==='anticipo'&&yaC>0){pg.saldo=Math.max(0,costoNuevo-yaC);}
    else{pg.cobrado=nc;pg.saldo=ns;}
    if(ncu.length)pg.cuotas=ncu;
    await dPut('pagos',pg);
  } else if(costoNuevo>0){
    const nid=await dAdd('pagos',{pacienteId:c.pacienteId,citaId,concepto:c.procedimiento,fecha:c.fecha,total:costoNuevo,cobrado:nc,saldo:ns,metodo:met||'—',tipoPago:ecPagoTipo,cuotas:ncu,creadoEn:new Date().toISOString()});
    if(ecPagoTipo==='cuotas'&&ncu.length>0) await dAdd('planPagos',{pacienteId:c.pacienteId,pagoId:nid,citaId,concepto:c.procedimiento,totalAcordado:costoNuevo,anticipo:0,metodoPreferido:met||'',estado:'activo',cuotas:ncu,totalCuotas:ncu.reduce((a,q)=>a+q.monto,0),cobrado:0,saldo:costoNuevo,fechaCreacion:c.fecha,creadoEn:new Date().toISOString()});
  }
  closeM('m-edit');toast('Cita actualizada ✅');renderCitas();renderDash();
}

// ══════════════════════════════════════════
// PLANES DE TRATAMIENTO
// ══════════════════════════════════════════
async function openNuevoPlan(planId = null){
  let pl = {};
  if(planId) {
     const planes = await dAll('planes');
     pl = planes.find(x=>x.id===planId) || {};
  }
  document.getElementById('m-plan').querySelector('.mtit span').textContent = planId ? '✏️ Editar Plan' : '🗂️ Plan de Tratamiento';
  document.getElementById('mpl-body').innerHTML=`
    <input type="hidden" id="pl-edit-id" value="${planId || ''}">
    <div class="sec hi" style="margin-bottom:11px"><h4>Paciente</h4>
      ${planId ? `<div style="padding:10px;background:var(--tbg);border:1px solid var(--bdr);border-radius:7px;font-size:12px;color:var(--teal);font-weight:600">👤 Paciente asignado (no se puede cambiar)</div><input type="hidden" id="pl-id" value="${pl.pacienteId}">` : buildAcField('pl','Buscar paciente')}
    </div>
    <div class="fgrid">
      <div class="fg full"><label>Nombre del Plan *</label><input id="pl-nom" value="${pl.nombre||''}" placeholder="Ej: Ortodoncia completa"></div>
      <div class="fg"><label>Tipo</label><select id="pl-tipo"><option ${pl.tipo==='Ortodoncia'?'selected':''}>Ortodoncia</option><option ${pl.tipo==='Endodoncia'?'selected':''}>Endodoncia</option><option ${pl.tipo==='Implantología'?'selected':''}>Implantología</option><option ${pl.tipo==='Periodoncia'?'selected':''}>Periodoncia</option><option ${pl.tipo==='Blanqueamiento'?'selected':''}>Blanqueamiento</option><option ${pl.tipo==='Rehabilitación Oral'?'selected':''}>Rehabilitación Oral</option><option ${pl.tipo==='Cirugía Oral'?'selected':''}>Cirugía Oral</option><option ${pl.tipo==='Otro'?'selected':''}>Otro</option></select></div>
      <div class="fg"><label>Duración estimada</label><select id="pl-dur"><option ${pl.duracion==='1 mes'?'selected':''}>1 mes</option><option ${pl.duracion==='3 meses'?'selected':''}>3 meses</option><option ${pl.duracion==='6 meses'?'selected':''}>6 meses</option><option ${pl.duracion==='1 año'?'selected':''}>1 año</option><option ${pl.duracion==='18 meses'?'selected':''}>18 meses</option><option ${pl.duracion==='2 años'?'selected':''}>2 años</option><option ${pl.duracion==='Indefinido'?'selected':''}>Indefinido</option></select></div>
      <div class="fg"><label>Costo total (S/.)</label><input type="number" id="pl-cos" value="${pl.costo||''}" placeholder="0.00" min="0" step="0.01"></div>
      <div class="fg"><label>Sesiones estimadas</label><input type="number" id="pl-nses" value="${pl.nSesiones||''}" placeholder="Ej: 24" min="1"></div>
      <div class="fg full"><label>Descripción</label><textarea id="pl-desc" placeholder="Objetivos del tratamiento...">${pl.descripcion||''}</textarea></div>
    </div>
    <div class="factions"><button class="btn btn-p" onclick="savePlan()">${planId ? '💾 Guardar Cambios' : '🗂️ Crear Plan'}</button><button class="btn btn-g" onclick="closeM('m-plan')">Cancelar</button></div>`;
  openM('m-plan');
}

async function savePlan(){
  const planId = document.getElementById('pl-edit-id')?.value;
  const pacId=parseInt(document.getElementById('pl-id')?.value);
  const nom=(document.getElementById('pl-nom')?.value||'').trim();
  if(!pacId){toast('Selecciona un paciente','err');return;}
  if(!nom){toast('Nombre del plan obligatorio','err');return;}
  
  if(planId) {
     const planes=await dAll('planes'); const pl=planes.find(x=>x.id===parseInt(planId));
     if(pl) {
       pl.nombre=nom; pl.tipo=document.getElementById('pl-tipo')?.value||''; pl.duracion=document.getElementById('pl-dur')?.value||''; pl.costo=parseFloat(document.getElementById('pl-cos')?.value)||0; pl.nSesiones=parseInt(document.getElementById('pl-nses')?.value)||0; pl.descripcion=document.getElementById('pl-desc')?.value||'';
       await dPut('planes',pl);
       toast('Plan actualizado ✅');
     }
  } else {
     await dAdd('planes',{pacienteId:pacId,nombre:nom,tipo:document.getElementById('pl-tipo')?.value||'',duracion:document.getElementById('pl-dur')?.value||'',costo:parseFloat(document.getElementById('pl-cos')?.value)||0,nSesiones:parseInt(document.getElementById('pl-nses')?.value)||0,descripcion:document.getElementById('pl-desc')?.value||'',estado:'activo',creadoEn:new Date().toISOString()});
     toast('Plan creado ✅');
  }
  closeM('m-plan');renderPlanes();
}
async function renderPlanes(){
  const [planes,pacs,citas]=await Promise.all([dAll('planes'),dAll('pacientes'),dAll('citas')]);
  const pm=Object.fromEntries(pacs.map(p=>[p.id,p]));
  const q=(document.getElementById('q-plan')?.value||'').toLowerCase();
  const fil=planes.filter(pl=>(pm[pl.pacienteId]?.nombre||'').toLowerCase().includes(q)||(pl.nombre||'').toLowerCase().includes(q));
  
  const cont=document.getElementById('lista-planes');
  if(!fil.length){cont.innerHTML='<div class="empty"><div class="ei">🗂️</div><p>Sin planes de tratamiento</p></div>';return;}
  
  cont.innerHTML=fil.map(pl=>{
    const p=pm[pl.pacienteId]||{};
    const cp=citas.filter(c=>c.planId===pl.id).sort((a,b)=>{
      const aComp = a.estado === 'completada' ? 1 : 0;
      const bComp = b.estado === 'completada' ? 1 : 0;
      if (aComp !== bComp) return aComp - bComp;
      
      // ORDEN CLÍNICO INTELIGENTE:
      // Si están completadas, mostrar la más reciente primero (descendente)
      if (aComp === 1) return b.fecha.localeCompare(a.fecha);
      // Si están pendientes, mostrar la más próxima a hoy primero (ascendente)
      return a.fecha.localeCompare(b.fecha);
    });
    
    // Aquí se genera el historial clínico
    const historialHtml = cp.length 
      ? `<div style="margin-top:12px;border-top:1px dashed var(--bdr);padding-top:10px">
           <div style="font-size:10px;font-weight:700;color:var(--tx2);text-transform:uppercase;margin-bottom:6px">Historial clínico de ${cp.length} Sesiones</div>` 
           + cp.map(c => {
             // Extraer el nombre base y asegurar que la numeración sea correcta (Sesión 1, 2, 3...)
             const baseName = (c.procedimiento||'—').split(' — Sesión')[0];
             const procFormateado = c.totalSesiones > 1 ? `${baseName} — Sesión ${c.sesionNum || 1}` : baseName;
             
             return `<div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04)">
             <div style="display:flex;flex-direction:column;gap:3px;flex:1">
               <div style="display:grid;grid-template-columns:85px 1fr;gap:5px">
                 <span style="color:var(--teal);font-weight:600">${fDate(c.fecha)}</span>
                 <span style="color:var(--tx)">${procFormateado}</span>
               </div>
               ${c.notasFin ? `<div style="color:var(--tx3);font-size:10px;margin-left:90px">📝 ${c.notasFin}</div>` : ''}
             </div>
             <div style="margin-left:8px"><span class="b ${eBadge(c.estado)}" style="font-size:9px">${eLabel(c.estado)}</span></div>
           </div>`;
           }).join('') + `</div>` 
      : '<div style="margin-top:12px;font-size:11px;color:var(--tx3);padding:8px;background:var(--s2);border-radius:6px">No hay citas ni avances registrados en esta carpeta aún.</div>';

    return `<div class="card" style="border-color:rgba(142,68,173,.2)">
    <div class="ctit"><div class="pname">${avt(p.nombre||'?',30)}<div><div style="font-size:13px">${p.nombre||'—'}</div><div style="font-size:10px;color:var(--tx2)">${p.telefono||''}</div></div></div>
      <div style="text-align:right"><span class="b b-purple">${pl.estado}</span><div class="mono t-teal" style="font-size:17px;margin-top:2px">${fMon(pl.costo)}</div></div>
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:2px">${pl.nombre}</div>
    <div style="font-size:11px;color:var(--tx2);margin-bottom:7px">${pl.tipo} · ${pl.duracion}${pl.nSesiones?' · '+pl.nSesiones+' sesiones':''}</div>
    ${pl.descripcion?`<div style="font-size:11px;color:var(--tx3);margin-bottom:7px">${pl.descripcion}</div>`:''}
    
    ${historialHtml}
    
    <div style="display:flex;gap:5px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-sm btn-p" onclick="openNuevaCita(${pl.pacienteId}, ${pl.id})">📅 Agendar Sesión</button>
      <button class="btn btn-sm btn-info" onclick="openNuevoPlan(${pl.id})">✏️ Editar</button>
      <button class="btn btn-sm btn-err" onclick="delPlan(${pl.id})">🗑 Eliminar Plan</button>
    </div>
  </div>`;}).join('');
}
async function delPlan(id){if(!confirm('¿Eliminar plan?'))return;await dDel('planes',id);toast('Eliminado','warn');renderPlanes();}

// ══════════════════════════════════════════
// FINANZAS
// ══════════════════════════════════════════
async function renderFin(){
  const [pagos,pacs]=await Promise.all([dAll('pagos'),dAll('pacientes')]);
  const pm=Object.fromEntries(pacs.map(p=>[p.id,p]));
  const mes=mesActual();
  const q=(document.getElementById('q-fin')?.value||'').toLowerCase();
  document.getElementById('f-tot').textContent=fMon(pagos.reduce((a,g)=>a+parseFloat(g.cobrado||0),0));
  document.getElementById('f-mes').textContent=fMon(pagos.filter(g=>(g.fechaUltPago||g.fecha||'').startsWith(mes)).reduce((a,g)=>a+parseFloat(g.cobrado||0),0));
  document.getElementById('f-fin').textContent=fMon(pagos.filter(g=>g.tipoPago==='cuotas').reduce((a,g)=>a+parseFloat(g.saldo||0),0));
  document.getElementById('f-pen').textContent=fMon(pagos.reduce((a,g)=>a+parseFloat(g.saldo||0),0));
  const tipoL={contado:'Contado',completo:'Pagado',anticipo:'Anticipo',cuotas:'Cuotas',cortesia:'Cortesía',sesion:'Sesión',parcial_completado:'Parcial'};
  const fil=pagos.filter(g=>{const p=pm[g.pacienteId];return(p?.nombre||'').toLowerCase().includes(q)||(g.concepto||'').toLowerCase().includes(q);}).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const tb=document.getElementById('tb-fin');
  tb.innerHTML=fil.map(g=>{const p=pm[g.pacienteId]||{};const s=parseFloat(g.saldo||0);return`<tr>
    <td><div class="pname">${avt(p.nombre||'?',22)}<span>${p.nombre||'—'}</span></div></td>
    <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.concepto||'—'}</td>
    <td>${fDate(g.fecha)}</td><td>${fMon(g.total)}</td>
    <td class="t-ok fw7">${fMon(g.cobrado)}</td>
    <td class="${s>0?'t-err':'t-ok'} fw7">${s>0?fMon(s):'✓'}</td>
    <td>${g.tipoPago?`<span class="b b-teal">${tipoL[g.tipoPago]||g.tipoPago}</span>`:'—'}</td>
    <td>${g.metodo||'—'}</td></tr>`;}).join('')||'<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--tx2)">Sin registros</td></tr>';
}

// ══════════════════════════════════════════
// DEUDAS
// ══════════════════════════════════════════
async function renderDeudas(){
  const [pagos,pacs]=await Promise.all([dAll('pagos'),dAll('pacientes')]);
  const pm=Object.fromEntries(pacs.map(p=>[p.id,p]));
  const q=(document.getElementById('q-deu')?.value||'').toLowerCase();
  const dMap={};
  // Exclude cuotas (they live in planPagos)
  pagos.filter(g=>parseFloat(g.saldo||0)>0&&g.tipoPago!=='cuotas').forEach(g=>{if(!dMap[g.pacienteId])dMap[g.pacienteId]=[];dMap[g.pacienteId].push(g);});
  const entries=Object.entries(dMap).map(([pid,gs])=>({pid:parseInt(pid),gs:gs.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')),total:gs.reduce((a,g)=>a+parseFloat(g.saldo||0),0),fechaR:gs[0]?.fecha||''})).filter(e=>(pm[e.pid]?.nombre||'').toLowerCase().includes(q)).sort((a,b)=>b.fechaR.localeCompare(a.fechaR));
  const cont=document.getElementById('lista-deudas');
  if(!entries.length){cont.innerHTML='<div class="empty"><div class="ei">✅</div><p>Sin cuentas pendientes</p></div>';return;}
  cont.innerHTML=entries.map(e=>{const p=pm[e.pid]||{};return`<div class="card" style="border-color:rgba(231,76,60,.18)">
    <div class="ctit"><div class="pname">${avt(p.nombre||'?',34)}<div><div style="font-size:13px;font-weight:700">${p.nombre||'—'}</div><div style="font-size:10px;color:var(--tx2)">${p.telefono||''}</div></div></div>
      <span class="mono fw7 t-err" style="font-size:21px">${fMon(e.total)}</span>
    </div>
    ${e.gs.map(g=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--bdr);flex-wrap:wrap;gap:5px">
      <div><div style="font-weight:600;font-size:12px">${g.concepto||'—'}</div><div style="font-size:10px;color:var(--tx2)">📅 ${fDate(g.fecha)} · Total: ${fMon(g.total)} · Cobrado: <span class="t-ok">${fMon(g.cobrado)}</span></div></div>
      <div style="display:flex;gap:5px;align-items:center"><span class="fw7 t-err">${fMon(g.saldo)}</span><button class="btn btn-sm btn-p" onclick="abrirCobro(${g.citaId})">💳</button></div>
    </div>`).join('')}
  </div>`;}).join('');
}

// ══════════════════════════════════════════
// PLANES DE PAGO
// ══════════════════════════════════════════
function openNuevoPP(){
  document.getElementById('mpp-body').innerHTML=`
    <div class="sec hi" style="margin-bottom:11px"><h4>Paciente</h4>${buildAcField('pp','Buscar paciente')}</div>
    <div class="fgrid" style="margin-bottom:10px">
      <div class="fg full"><label>Concepto del Plan</label><input id="pp-con" placeholder="Ej: Ortodoncia completa"></div>
      <div class="fg"><label>Monto total a financiar (S/.)</label><input type="number" id="pp-tot" placeholder="0.00" min="0" step="0.01" oninput="ppGenCuotas()"></div>
      <div class="fg"><label>Anticipo / Enganche (S/.)</label><input type="number" id="pp-ant" value="0" min="0" step="0.01" oninput="ppGenCuotas()"></div>
      <div class="fg"><label>Número de cuotas</label><input type="number" id="pp-n" value="3" min="1" max="48" oninput="ppGenCuotas()"></div>
      <div class="fg"><label>Intervalo</label><select id="pp-int" onchange="ppGenCuotas()"><option value="7">Semanal</option><option value="15">Quincenal</option><option value="30" selected>Mensual</option><option value="60">Bimestral</option><option value="90">Trimestral</option></select></div>
      <div class="fg"><label>Primera cuota</label><input type="date" id="pp-f1" value="${addDays(hoy(),30)}" oninput="ppGenCuotas()"></div>
      <div class="fg"><label>Método preferido</label><select id="pp-met"><option value="">Por definir</option><option>Efectivo</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select></div>
    </div>
    <div id="pp-res"></div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--tx2);margin-bottom:7px;margin-top:10px">Tabla de cuotas (editable)</div>
    <div id="pp-tabla"></div>
    <div class="factions"><button class="btn btn-p" onclick="guardarPP()">🗓️ Crear Plan</button><button class="btn btn-g" onclick="closeM('m-pp')">Cancelar</button></div>`;
  openM('m-pp');
  ppGenCuotas();
}
function ppGenCuotas(){
  const tot=parseFloat(document.getElementById('pp-tot')?.value)||0;
  const ant=parseFloat(document.getElementById('pp-ant')?.value)||0;
  const n=parseInt(document.getElementById('pp-n')?.value)||0;
  const int=parseInt(document.getElementById('pp-int')?.value)||30;
  const f1=document.getElementById('pp-f1')?.value||addDays(hoy(),30);
  const rest=Math.max(0,tot-ant);
  const m=n>0?(rest/n).toFixed(2):0;
  const res=document.getElementById('pp-res');
  if(res) res.innerHTML=`<div class="rpago"><div class="rrow"><span>Total a financiar</span><strong>${fMon(tot)}</strong></div>${ant>0?`<div class="rrow"><span>Anticipo</span><strong class="t-ok">${fMon(ant)}</strong></div>`:''}<div class="rrow"><span>En cuotas</span><strong>${fMon(rest)}</strong></div><div class="rrow tot"><span>${n} cuotas de</span><strong class="t-teal">${fMon(parseFloat(m))}</strong></div></div>`;
  const tab=document.getElementById('pp-tabla');if(!tab||n<1)return;
  let html=`<table class="ctab"><thead><tr><th>#</th><th>Fecha</th><th>Monto (S/.)</th><th>Tipo</th></tr></thead><tbody>`;
  if(ant>0) html+=`<tr><td><span class="b b-ok">0</span></td><td><input type="date" id="pp-fec-ant" value="${hoy()}"></td><td><input type="number" id="pp-mon-ant" value="${ant.toFixed(2)}" min="0" step="0.01"></td><td><span class="b b-warn">Anticipo</span></td></tr>`;
  for(let i=0;i<n;i++){const fd=i===0?f1:addDays(f1,i*int);html+=`<tr><td><span class="b b-teal">${i+1}</span></td><td><input type="date" id="pp-fec-${i}" value="${fd}"></td><td><input type="number" id="pp-mon-${i}" value="${m}" min="0" step="0.01"></td><td><span class="b b-gray">Pendiente</span></td></tr>`;}
  tab.innerHTML=html+'</tbody></table>';
}
async function guardarPP(){
  const pacId=parseInt(document.getElementById('pp-id')?.value);
  const con=(document.getElementById('pp-con')?.value||'').trim();
  const tot=parseFloat(document.getElementById('pp-tot')?.value)||0;
  const ant=parseFloat(document.getElementById('pp-ant')?.value)||0;
  const n=parseInt(document.getElementById('pp-n')?.value)||0;
  const met=document.getElementById('pp-met')?.value||'';
  if(!pacId){toast('Selecciona un paciente','err');return;}
  if(!tot||n<1){toast('Monto y cuotas obligatorios','err');return;}
  const cuotas=[];
  if(ant>0) cuotas.push({num:0,tipo:'anticipo',fecha:document.getElementById('pp-fec-ant')?.value||hoy(),monto:parseFloat(document.getElementById('pp-mon-ant')?.value)||ant,pagado:false,fechaPago:null,metodoPago:null});
  for(let i=0;i<n;i++) cuotas.push({num:i+1,tipo:'cuota',fecha:document.getElementById('pp-fec-'+i)?.value||hoy(),monto:parseFloat(document.getElementById('pp-mon-'+i)?.value)||0,pagado:false,fechaPago:null,metodoPago:null});
  const totC=cuotas.reduce((a,q)=>a+q.monto,0);
  await dAdd('planPagos',{pacienteId:pacId,pagoId:0,citaId:0,concepto:con,totalAcordado:tot,anticipo:ant,metodoPreferido:met,estado:'activo',cuotas,totalCuotas:totC,cobrado:0,saldo:totC,fechaCreacion:hoy(),creadoEn:new Date().toISOString()});
  closeM('m-pp');toast('Plan de pago creado ✅');renderPlanPagos();
}
async function renderPlanPagos(){
  const [planes,pacs]=await Promise.all([dAll('planPagos'),dAll('pacientes')]);
  const pm=Object.fromEntries(pacs.map(p=>[p.id,p]));
  const q=(document.getElementById('q-pp')?.value||'').toLowerCase();
  const fil=planes.filter(pl=>(pm[pl.pacienteId]?.nombre||'').toLowerCase().includes(q)||(pl.concepto||'').toLowerCase().includes(q)).sort((a,b)=>(b.fechaCreacion||'').localeCompare(a.fechaCreacion||''));
  const cont=document.getElementById('lista-pp');
  
  if(!fil.length){cont.innerHTML='<div class="empty"><div class="ei">🗓️</div><p>Sin planes de pago. Se crean automáticamente al agendar una cita en cuotas.</p></div>';return;}
  
  const hoyStr=hoy();
  cont.innerHTML=fil.map(pl=>{
    const p=pm[pl.pacienteId]||{};
    const cuotasPendientes = (pl.cuotas||[]).filter(q => !q.pagado);
    const cuotasPagadas    = (pl.cuotas||[]).filter(q => q.pagado);
    const totalPagado = cuotasPagadas.reduce((a,q) => a+q.monto, 0);
    const totalPend   = cuotasPendientes.reduce((a,q) => a+q.monto, 0);
    const vencidas = cuotasPendientes.filter(q => q.fecha && q.fecha < hoyStr).length;

    return `<div class="card" style="border-color:${pl.estado==='activo'?'rgba(0,180,216,.2)':'rgba(136,153,170,.2)'}">
      <div class="ctit">
        <div class="pname">${avt(p.nombre||'?',34)}
          <div>
            <div style="font-size:14px;font-weight:700">${p.nombre||'—'}</div>
            <div style="font-size:12px;color:var(--tx2)">${pl.concepto||''}</div>
          </div>
        </div>
        <div style="text-align:right">
          <span class="b ${pl.estado==='activo'?'b-teal':'b-gray'}">${pl.estado}</span>
          <div class="mono" style="font-size:20px;margin-top:3px;color:var(--tx)">${fMon(pl.totalAcordado)}</div>
        </div>
      </div>

      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span>Pagado: <strong class="t-ok">${fMon(totalPagado)}</strong></span>
          <span>Pendiente: <strong class="${vencidas>0?'t-err':'t-warn'}">${fMon(totalPend)}</strong></span>
          ${vencidas>0?`<span class="b b-err">⚠️ ${vencidas} cuota(s) vencida(s)</span>`:''}
        </div>
        <div style="height:6px;border-radius:3px;background:var(--s2);overflow:hidden">
          <div style="height:100%;border-radius:3px;background:var(--ok);width:${pl.totalCuotas>0?(totalPagado/pl.totalCuotas*100).toFixed(1):0}%;transition:width .3s"></div>
        </div>
      </div>

      <table class="ctab">
        <thead><tr><th>#</th><th>Fecha</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>
        ${(pl.cuotas||[]).map((q, idx)=>{
          const vencida = !q.pagado && q.fecha && q.fecha < hoyStr;
          return `<tr style="${vencida?'background:rgba(231,76,60,.04)':''}">
            <td><span class="b ${q.tipo==='anticipo'?'b-warn':'b-teal'}">${q.tipo==='anticipo'?'Ant':q.num}</span></td>
            <td>${q.pagado ? `<span class="t-ok">${fDate(q.fecha)}</span>` : `<input type="date" id="pq-f-${pl.id}-${idx}" value="${q.fecha||''}" style="padding:3px 6px;font-size:11px;max-width:130px">`}</td>
            <td>${q.pagado ? `<span class="fw7 t-ok">${fMon(q.monto)}</span>` : `<input type="number" id="pq-m-${pl.id}-${idx}" value="${q.monto}" min="0" step="0.01" style="padding:3px 6px;font-size:11px;max-width:90px">`}</td>
            <td>${q.pagado ? `<span class="b b-ok">✅ Pagado ${fDate(q.fechaPago)}</span>` : (vencida ? '<span class="b b-err">⚠️ Vencida</span>' : '<span class="b b-gray">Pendiente</span>')}</td>
            <td><div style="display:flex;gap:4px">${q.pagado?`<button class="btn btn-xs btn-g" onclick="ppDesmarcar(${pl.id},${idx})">↩</button>`:`<button class="btn btn-xs btn-ok" onclick="ppPagar(${pl.id},${idx})">💵</button><button class="btn btn-xs btn-err" onclick="ppQuitarCuota(${pl.id},${idx})">🗑️</button>`}</div></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>

      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-g" onclick="ppGuardarCambios(${pl.id})">💾 Guardar cambios de fechas/montos</button>
        <button class="btn btn-sm btn-info" onclick="ppAgregar(${pl.id})">＋ Cuota</button>
        ${pl.estado==='activo'?`<button class="btn btn-sm btn-g" onclick="ppCerrar(${pl.id})">🔒 Cerrar plan</button>`:''}
        <button class="btn btn-xs btn-err" onclick="ppEliminar(${pl.id})">🗑</button>
      </div>
    </div>`;
  }).join('');
}
async function ppPagar(plId,idx){
  const planes=await dAll('planPagos');const pl=planes.find(x=>x.id===plId);if(!pl)return;
  const q=pl.cuotas[idx];if(!q||q.pagado)return;
  const met=prompt('Método de pago:',pl.metodoPreferido||'Efectivo');if(met===null)return;
  q.pagado=true;q.fechaPago=hoy();q.metodoPago=met;
  pl.cobrado=(pl.cuotas||[]).filter(c=>c.pagado).reduce((a,c)=>a+c.monto,0);
  pl.saldo=Math.max(0,(pl.totalCuotas||0)-pl.cobrado);
  if(pl.saldo===0)pl.estado='completado';
  await dPut('planPagos',pl);
  
  // NUEVO: Sincronizar con Finanzas
  if(pl.pagoId){
    const pagos=await dAll('pagos');const pg=pagos.find(x=>x.id===pl.pagoId);
    if(pg){
      pg.cobrado=pl.cobrado;pg.saldo=pl.saldo;pg.fechaUltPago=hoy();
      if(pg.cuotas&&pg.cuotas[idx]){pg.cuotas[idx].pagado=true;pg.cuotas[idx].fechaPago=hoy();}
      await dPut('pagos',pg);
    }
  }
  toast('Cuota pagada ✅');renderPlanPagos();renderFin();renderDash();
}
async function ppDesmarcar(plId,idx){
  if(!confirm('¿Revertir este pago?'))return;
  const planes=await dAll('planPagos');const pl=planes.find(x=>x.id===plId);if(!pl)return;
  const q=pl.cuotas[idx];if(!q)return;
  q.pagado=false;q.fechaPago=null;q.metodoPago=null;pl.estado='activo';
  pl.cobrado=(pl.cuotas||[]).filter(c=>c.pagado).reduce((a,c)=>a+c.monto,0);
  pl.saldo=Math.max(0,(pl.totalCuotas||0)-pl.cobrado);
  await dPut('planPagos',pl);

  // NUEVO: Sincronizar reversión con Finanzas
  if(pl.pagoId){
    const pagos=await dAll('pagos');const pg=pagos.find(x=>x.id===pl.pagoId);
    if(pg){
      pg.cobrado=pl.cobrado;pg.saldo=pl.saldo;
      if(pg.cuotas&&pg.cuotas[idx]){pg.cuotas[idx].pagado=false;pg.cuotas[idx].fechaPago=null;}
      await dPut('pagos',pg);
    }
  }
  toast('Revertido','warn');renderPlanPagos();renderFin();renderDash();
}
async function ppGuardarCambios(plId){
  const planes=await dAll('planPagos');const pl=planes.find(x=>x.id===plId);if(!pl)return;
  (pl.cuotas||[]).forEach((q,i)=>{
    if(!q.pagado){
      const nf=document.getElementById('pq-f-'+plId+'-'+i)?.value;
      const nm=parseFloat(document.getElementById('pq-m-'+plId+'-'+i)?.value);
      if(nf)q.fecha=nf;if(!isNaN(nm)&&nm>=0)q.monto=nm;
    }
  });
  pl.totalCuotas=(pl.cuotas||[]).reduce((a,q)=>a+q.monto,0);
  pl.saldo=Math.max(0,pl.totalCuotas-(pl.cobrado||0));
  pl.totalAcordado=pl.totalCuotas; // Actualiza la meta global
  await dPut('planPagos',pl);
  
  // Sincronizar maestro
  if(pl.pagoId){
    const pagos=await dAll('pagos');const pg=pagos.find(x=>x.id===pl.pagoId);
    if(pg){ pg.cuotas=pl.cuotas; pg.total=pl.totalCuotas; pg.saldo=pl.saldo; await dPut('pagos',pg); }
  }
  toast('Cambios guardados ✅');renderPlanPagos();
}
function reajustarCuotas(pl) {
  const pendientes = pl.cuotas.filter(q => !q.pagado && q.tipo !== 'anticipo');
  if (pendientes.length === 0) return;
  const pagado = pl.cuotas.filter(q => q.pagado).reduce((a,c) => a + c.monto, 0);
  const antPend = pl.cuotas.filter(q => !q.pagado && q.tipo === 'anticipo').reduce((a,c) => a + c.monto, 0);
  
  // Reparte el dinero que falta entre las cuotas que quedan
  const aDistribuir = Math.max(0, pl.totalAcordado - pagado - antPend);
  const nuevoMonto = parseFloat((aDistribuir / pendientes.length).toFixed(2));
  
  pendientes.forEach(q => q.monto = nuevoMonto);
  pl.totalCuotas = pl.cuotas.reduce((a,q) => a + q.monto, 0);
  pl.cobrado = pagado;
  pl.saldo = Math.max(0, pl.totalCuotas - pl.cobrado);
}

async function ppAgregar(plId){
  const planes=await dAll('planPagos');const pl=planes.find(x=>x.id===plId);if(!pl)return;
  const ult = pl.cuotas[pl.cuotas.length-1];
  const nFec = ult && ult.fecha ? addDays(ult.fecha, 30) : addDays(hoy(), 30);
  
  pl.cuotas.push({num: 0, tipo:'cuota', fecha:nFec, monto:0, pagado:false, fechaPago:null, metodoPago:null});
  
  // Renumerar y recalcular
  let cont = 1; pl.cuotas.forEach(q => { if(q.tipo !== 'anticipo') { q.num = cont++; } });
  reajustarCuotas(pl);
  
  await dPut('planPagos',pl);
  if(pl.pagoId){ const pagos=await dAll('pagos');const pg=pagos.find(x=>x.id===pl.pagoId); if(pg){ pg.cuotas=pl.cuotas; await dPut('pagos',pg); } }
  
  toast('Cuota agregada y montos ajustados');renderPlanPagos();
}

async function ppQuitarCuota(plId, idx){
  if(!confirm('¿Eliminar esta cuota pendiente?'))return;
  const planes=await dAll('planPagos');const pl=planes.find(x=>x.id===plId);if(!pl)return;
  
  pl.cuotas.splice(idx, 1);
  
  // Renumerar y recalcular
  let cont = 1; pl.cuotas.forEach(q => { if(q.tipo !== 'anticipo') { q.num = cont++; } });
  reajustarCuotas(pl);
  
  await dPut('planPagos',pl);
  if(pl.pagoId){ const pagos=await dAll('pagos');const pg=pagos.find(x=>x.id===pl.pagoId); if(pg){ pg.cuotas=pl.cuotas; await dPut('pagos',pg); } }
  
  toast('Cuota eliminada y montos ajustados','warn');renderPlanPagos();
}
async function ppCerrar(plId){if(!confirm('¿Cerrar este plan?'))return;const planes=await dAll('planPagos');const pl=planes.find(x=>x.id===plId);if(!pl)return;pl.estado='completado';await dPut('planPagos',pl);toast('Plan cerrado');renderPlanPagos();}
async function ppEliminar(plId){if(!confirm('¿Eliminar plan?'))return;await dDel('planPagos',plId);toast('Eliminado','warn');renderPlanPagos();}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
async function renderDash(){
  const [pacs,citas,pagos]=await Promise.all([dAll('pacientes'),dAll('citas'),dAll('pagos')]);
  const h=hoy(),mes=mesActual(),man=addDays(h,1);
  const pm=Object.fromEntries(pacs.map(p=>[p.id,p]));
  const citasH=citas.filter(c=>c.fecha===h&&c.estado!=='cancelada');
  document.getElementById('s-pac').textContent=pacs.length;
  document.getElementById('s-pac-s').textContent=pacs.length+' registrados';
  document.getElementById('s-hoy').textContent=citasH.length;
  document.getElementById('s-hoy-s').textContent=citasH.filter(c=>c.estado==='en_atencion').length+' en atención';
  document.getElementById('s-ing').textContent=fMon(pagos.filter(g=>(g.fechaUltPago||g.fecha||'').startsWith(mes)).reduce((a,g)=>a+parseFloat(g.cobrado||0),0));
  const deus=pagos.filter(g=>parseFloat(g.saldo||0)>0);
  document.getElementById('s-deu').textContent=fMon(deus.reduce((a,g)=>a+parseFloat(g.saldo||0),0));
  document.getElementById('s-deu-s').textContent=deus.length+' deudas';
  const dfEl=document.getElementById('d-fecha');
  if(dfEl) dfEl.textContent=new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});
  const ch=citasH.sort((a,b)=>a.hora.localeCompare(b.hora));
  document.getElementById('d-hoy').innerHTML=ch.length?ch.slice(0,5).map(c=>{const p=pm[c.pacienteId]||{};return`<div class="cc" style="padding:7px 9px"><div class="ctime"><div class="ct" style="font-size:11px">${c.hora}</div></div><div class="cinfo" style="flex:1"><div class="pn" style="font-size:12px">${p.nombre||'—'}</div><div class="tr">${c.procedimiento||'—'}</div></div><span class="b ${eBadge(c.estado)}" style="font-size:10px">${eLabel(c.estado)}</span></div>`;}).join(''):'<div class="empty" style="padding:12px"><p>Sin citas hoy</p></div>';
  const ea=citas.filter(c=>c.estado==='en_atencion');
  document.getElementById('d-aten').innerHTML=ea.length?ea.map(c=>{const p=pm[c.pacienteId]||{};return`<div class="cc" style="padding:7px 9px;border-color:rgba(231,76,60,.3)"><div style="width:7px;height:7px;border-radius:50%;background:var(--err);flex-shrink:0;box-shadow:0 0 6px var(--err);animation:pulse 1s infinite;margin-top:4px"></div><div class="cinfo" style="flex:1"><div class="pn" style="font-size:12px">${p.nombre||'—'}</div><div class="tr">${c.procedimiento||'—'}</div></div><button class="btn btn-xs btn-ok" onclick="abrirCompletar(${c.id})">✓</button></div>`;}).join(''):'<div class="empty" style="padding:12px"><p>Nadie en atención</p></div>';
  let alerts='';
  if(deus.length) alerts+=`<div class="cc" style="padding:7px 9px;border-color:rgba(231,76,60,.2);cursor:pointer" onclick="goTo('deudas')"><span>💳</span><div class="cinfo"><div class="pn" style="font-size:12px">Cobros pendientes</div><div class="tr">${deus.length} paciente${deus.length!==1?'s':''} con saldo</div></div><span class="b b-err">${deus.length}</span></div>`;
  const sinV=pacs.filter(p=>{const u=citas.filter(c=>c.pacienteId===p.id&&c.estado==='completada').sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];return !u||((new Date()-new Date(u.fecha+'T12:00:00'))/86400000>180);}).length;
  if(sinV) alerts+=`<div class="cc" style="padding:7px 9px;border-color:rgba(243,156,18,.2);cursor:pointer" onclick="goTo('pacientes')"><span>📅</span><div class="cinfo"><div class="pn" style="font-size:12px">Sin visita reciente</div><div class="tr">${sinV} paciente${sinV!==1?'s':''} sin cita +6 meses</div></div><span class="b b-warn">${sinV}</span></div>`;
  document.getElementById('d-alerts').innerHTML=alerts||'<div class="empty" style="padding:12px"><p>✅ Todo al día</p></div>';
  const cm=citas.filter(c=>c.fecha===man&&c.estado!=='cancelada').sort((a,b)=>a.hora.localeCompare(b.hora));
  document.getElementById('d-man').innerHTML=cm.length?cm.slice(0,3).map(c=>{const p=pm[c.pacienteId]||{};return`<div class="cc" style="padding:7px 9px"><div class="ctime"><div class="ct" style="font-size:11px">${c.hora}</div></div><div class="cinfo" style="flex:1"><div class="pn" style="font-size:12px">${p.nombre||'—'}</div><div class="tr">${c.procedimiento||'—'}</div></div></div>`;}).join(''):'<div class="empty" style="padding:12px"><p>Sin citas mañana</p></div>';
}
// Variable global para almacenar las cuotas actuales antes de guardar
let cuotasActuales = [];

function calcularCuotas() {
    const numSesiones = parseInt(document.getElementById('plan-sesiones').value) || 1;
    const costoTotal = parseFloat(document.getElementById('plan-costo').value) || 0;
    const vincular = document.getElementById('vincular-pagos').checked;
    const contenedor = document.getElementById('contenedor-cuotas');
    const tbody = document.getElementById('body-cuotas');

    if (vincular && numSesiones > 0 && costoTotal > 0) {
        contenedor.style.display = 'block';
        cuotasActuales = []; // Reiniciamos el arreglo
        tbody.innerHTML = ''; // Limpiamos la tabla visual

        // Dividimos el costo en partes iguales
        let montoPorCuota = (costoTotal / numSesiones).toFixed(2);

        for (let i = 1; i <= numSesiones; i++) {
            // Creamos el objeto JSON tal como lo espera tu base de datos
            let cuota = {
                num: i,
                tipo: "cuota",
                monto: parseFloat(montoPorCuota),
                pagado: false,
                fechaPago: null,
                metodoPago: null
            };
            cuotasActuales.push(cuota);

            // Lo dibujamos en la tabla
            tbody.innerHTML += `
                <tr>
                    <td>Sesión ${i}</td>
                    <td>S/ <input type="number" value="${cuota.monto}" onchange="actualizarMontoManual(${i-1}, this.value)"></td>
                    <td>Pendiente</td>
                </tr>
            `;
        }
    } else {
        // Si desmarca el checkbox, ocultamos y limpiamos
        contenedor.style.display = 'none';
        cuotasActuales = [];
    }
}

function agregarCuotaExtra() {
    const numSesionesInput = document.getElementById('plan-sesiones');
    let nuevoNumero = parseInt(numSesionesInput.value) + 1;
    numSesionesInput.value = nuevoNumero; // Actualizamos el input visual

    let nuevaCuota = {
        num: nuevoNumero,
        tipo: "cuota_extra", // Etiqueta para saber que se agregó después
        monto: 0, // Se deja en 0 para que recepción ingrese el costo del nuevo procedimiento
        pagado: false,
        fechaPago: null,
        metodoPago: null
    };
    
    cuotasActuales.push(nuevaCuota);
    
    // Agregamos la fila a la tabla visual
    const tbody = document.getElementById('body-cuotas');
    tbody.innerHTML += `
        <tr style="background-color: #eef8ff;"> <!-- Destacar que es extra -->
            <td>Sesión ${nuevoNumero} (Extra)</td>
            <td>S/ <input type="number" value="0" onchange="actualizarMontoManual(${cuotasActuales.length - 1}, this.value)" placeholder="Monto extra"></td>
            <td>Pendiente</td>
        </tr>
    `;
}

const datosPlan = {
    // ... tus otros datos (pacienteId, descripción, etc)
    nSesiones: document.getElementById('plan-sesiones').value,
    costo: document.getElementById('plan-costo').value,
    // AQUÍ INYECTAS EL JSON DE LOS PAGOS VINCULADOS
    cuotas: JSON.stringify(cuotasActuales) 
};

// Permite modificar manualmente una cuota si el usuario lo desea
function actualizarMontoManual(index, nuevoMonto) {
    cuotasActuales[index].monto = parseFloat(nuevoMonto);
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
async function init(){
  try {
    await initDB();
    await refreshCache();
    const t=localStorage.getItem('dp-theme')||'dark';
    document.documentElement.setAttribute('data-theme',t);
    const tbtn=document.getElementById('tbtn');
    if(tbtn) tbtn.textContent=t==='light'?'🌙 Oscuro':'☀️ Claro';
    renderDash();
  } catch(e) {
    console.error('Init error:', e);
    document.body.innerHTML='<div style="padding:40px;text-align:center;font-family:sans-serif"><h2>⚠️ Error al cargar</h2><p style="margin-top:10px;color:#666">'+e.message+'</p><button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;cursor:pointer">Recargar</button></div>';
  }
}
init();