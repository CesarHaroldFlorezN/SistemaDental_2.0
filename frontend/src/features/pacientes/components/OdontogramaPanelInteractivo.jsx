import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ClipboardPlus, Eraser, Eye, History, Info, MousePointer2, RotateCcw, Save, Search, ShieldCheck, Sparkles, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import Swal from 'sweetalert2';
import { api } from '../../../services/api';

const PERMANENTES = [
  ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'],
  ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'],
];
const DECIDUAS = [
  ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'],
  ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'],
];

const HALLAZGOS = [
  ['ortodontico_fijo', 'Aparato ortodóntico fijo', '', 'variable', 'Aparatos'],
  ['ortodontico_removible', 'Aparato ortodóntico removible', '', 'variable', 'Aparatos'],
  ['corona', 'Corona', 'CM', 'variable', 'Restauraciones'],
  ['corona_temporal', 'Corona temporal', 'CT', 'rojo', 'Restauraciones'],
  ['defecto_esmalte', 'Defecto de desarrollo del esmalte', 'O', 'rojo', 'Hallazgos'],
  ['diastema', 'Diastema', '', 'azul', 'Posición'],
  ['edentulo_total', 'Edéntulo total', '', 'azul', 'Ausencias'],
  ['espigo_munon', 'Espigo–muñón', '', 'variable', 'Endodoncia'],
  ['fosas_fisuras', 'Fosas y fisuras profundas', 'FFP', 'azul', 'Hallazgos'],
  ['fractura', 'Fractura dental', '', 'rojo', 'Hallazgos'],
  ['fusion', 'Fusión', '', 'azul', 'Forma y tamaño'],
  ['geminacion', 'Geminación', '', 'azul', 'Forma y tamaño'],
  ['giroversion', 'Giroversión', '', 'azul', 'Posición'],
  ['impactacion', 'Impactación', 'I', 'azul', 'Erupción'],
  ['implante', 'Implante dental', 'IMP', 'variable', 'Rehabilitación'],
  ['caries', 'Lesión de caries dental', 'CD', 'rojo', 'Hallazgos'],
  ['macrodoncia', 'Macrodoncia', 'MAC', 'azul', 'Forma y tamaño'],
  ['microdoncia', 'Microdoncia', 'MIC', 'azul', 'Forma y tamaño'],
  ['movilidad', 'Movilidad patológica', 'M1', 'rojo', 'Periodoncia'],
  ['ausente', 'Pieza dentaria ausente', 'DNE', 'azul', 'Ausencias'],
  ['clavija', 'Pieza dentaria en clavija', '', 'azul', 'Forma y tamaño'],
  ['ectopica', 'Pieza dentaria ectópica', 'E', 'azul', 'Posición'],
  ['erupcion', 'Pieza dentaria en erupción', '', 'azul', 'Erupción'],
  ['extruida', 'Pieza dentaria extruida', '', 'azul', 'Posición'],
  ['intruida', 'Pieza dentaria intruida', '', 'azul', 'Posición'],
  ['supernumeraria', 'Pieza dentaria supernumeraria', 'S', 'azul', 'Forma y tamaño'],
  ['pulpotomia', 'Pulpotomía', 'PP', 'variable', 'Endodoncia'],
  ['posicion_anormal', 'Posición anormal dentaria', 'M', 'azul', 'Posición'],
  ['protesis_fija', 'Prótesis dental parcial fija', '', 'variable', 'Rehabilitación'],
  ['protesis_completa', 'Prótesis dental completa', '', 'variable', 'Rehabilitación'],
  ['protesis_removible', 'Prótesis dental parcial removible', '', 'variable', 'Rehabilitación'],
  ['remanente_radicular', 'Remanente radicular', 'RR', 'rojo', 'Ausencias'],
  ['restauracion_definitiva', 'Restauración definitiva', 'R', 'variable', 'Restauraciones'],
  ['restauracion_temporal', 'Restauración temporal', '', 'rojo', 'Restauraciones'],
  ['sellante', 'Sellante', 'S', 'variable', 'Prevención'],
  ['superficie_desgastada', 'Superficie desgastada', 'DES', 'rojo', 'Hallazgos'],
  ['tratamiento_conducto', 'Tratamiento de conducto', 'TC', 'variable', 'Endodoncia'],
  ['transposicion', 'Transposición dentaria', '', 'azul', 'Posición'],
].map(([codigo, nombre, sigla, color, categoria]) => ({
  codigo,
  nombre,
  sigla,
  color,
  categoria,
}));

const HALLAZGOS_FRECUENTES = ['caries', 'restauracion_definitiva', 'ausente', 'fractura', 'corona', 'tratamiento_conducto', 'remanente_radicular', 'sellante'];

const SIGLAS_POR_HALLAZGO = {
  caries: ['MB', 'CE', 'CD', 'CDP'],
  corona: ['CM', 'CF', 'CMC', 'CV', 'CLM'],
  ausente: ['DNE', 'DEX', 'DAO'],
  restauracion_definitiva: ['AM', 'R', 'IV', 'IM', 'IE', 'C'],
  movilidad: ['M1', 'M2', 'M3'],
  posicion_anormal: ['M', 'D', 'V', 'P', 'L'],
  tratamiento_conducto: ['TC', 'PC'],
  defecto_esmalte: ['O', 'PE'],
  implante: ['IMP'],
  pulpotomia: ['PP'],
};

const MOTIVOS = {
  evaluacion_inicial: 'Evaluación inicial',
  inicio_plan: 'Inicio del plan de tratamiento',
  nuevo_hallazgo: 'Nuevos hallazgos clínicos',
  fin_plan: 'Culminación del plan de tratamiento',
  reingreso: 'Reingreso del paciente',
  solicitud_legal_personal: 'Solicitud judicial o personal',
};

const NOMBRES_SUPERFICIES = {
  vestibular: 'Vestibular',
  lingual: 'Lingual',
  palatino: 'Palatino',
  mesial: 'Mesial',
  distal: 'Distal',
  oclusal: 'Oclusal',
  incisal: 'Incisal',
  raiz: 'Raíz',
};

const CONFIGURACION_SUPERFICIES = {
  caries: {
    permiteRaiz: true,
    ayuda: 'Marca las caras comprometidas. Activa compromiso radicular solo cuando la lesión alcance la raíz.',
  },
  defecto_esmalte: {
    ayuda: 'Marca únicamente las caras de la corona donde se observa el defecto.',
  },
  fosas_fisuras: {
    ayuda: 'Marca la cara donde se observan las fosas o fisuras profundas.',
  },
  fractura: {
    permiteRaiz: true,
    ayuda: 'Marca las caras afectadas y activa compromiso radicular solo si la fractura alcanza la raíz.',
  },
  restauracion_definitiva: {
    ayuda: 'Marca las caras ocupadas por la restauración observada.',
  },
  restauracion_temporal: {
    ayuda: 'Marca las caras ocupadas por la restauración temporal observada.',
  },
  sellante: {
    ayuda: 'Marca la cara con fosas o fisuras selladas. Se mostrará como trayecto, no como una superficie rellenada. Si observas caries, regístrala además como un hallazgo independiente.',
  },
  superficie_desgastada: {
    ayuda: 'Marca las caras en las que se observa desgaste.',
  },
};

const ANCHO_IMAGEN_ODONTOGRAMA = 1600;
const FILAS_PERMANENTES = [
  {
    piezas: PERMANENTES[0],
    centros: [76.5, 174, 279.5, 374, 468, 561, 647.5, 741, 846.5, 937, 1026, 1119, 1208.5, 1299.5, 1407, 1504.5],
    top: 1.2,
    height: 49.8,
  },
  {
    piezas: PERMANENTES[1],
    centros: [69.5, 182, 285, 381.5, 470.5, 560.5, 646, 740, 845, 938.5, 1019.5, 1112, 1203, 1299.5, 1411.5, 1517.5],
    top: 52.2,
    height: 46.7,
  },
];

const IMAGEN_ODONTOGRAMA = `${import.meta.env.BASE_URL}odontograma-fdi.webp`;

const colorHex = (color) => (color === 'rojo' ? '#dc2626' : '#2563eb');
const fechaLegible = (valor) => (valor ? new Date(valor).toLocaleString('es-PE') : 'Sin fecha');
const esSuperior = (numero) => ['1', '2', '5', '6'].includes(String(numero)[0]);
const esAnterior = (numero) => ['1', '2', '3'].includes(String(numero)[1]);
const ordenarPiezas = (piezas) => {
  const orden = [...PERMANENTES.flat(), ...DECIDUAS.flat()];
  return [...piezas].sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
};

const cajaHorizontal = (centros, indice) => {
  const centro = centros[indice];
  const izquierda = indice === 0 ? centro - (centros[1] - centro) / 2 : (centros[indice - 1] + centro) / 2;
  const derecha = indice === centros.length - 1 ? centro + (centro - centros[indice - 1]) / 2 : (centro + centros[indice + 1]) / 2;
  return {
    left: `${(izquierda / ANCHO_IMAGEN_ODONTOGRAMA) * 100}%`,
    width: `${((derecha - izquierda) / ANCHO_IMAGEN_ODONTOGRAMA) * 100}%`,
  };
};

const formularioInicial = (hallazgo = HALLAZGOS.find((item) => item.codigo === 'caries')) => ({
  codigo: hallazgo.codigo,
  sigla: hallazgo.sigla,
  color: hallazgo.color === 'variable' ? 'azul' : hallazgo.color,
  superficies: [],
  detalle: '',
});

function MiniSuperficies({ hallazgos, numero }) {
  const interna = esSuperior(numero) ? 'palatino' : 'lingual';
  const centro = esAnterior(numero) ? 'incisal' : 'oclusal';
  const sellante = [...hallazgos].reverse().find((item) => item.codigo === 'sellante');
  const superficieSellada = (superficie) => sellante?.superficies?.includes(superficie);
  const colorSellante = sellante ? colorHex(sellante.color) : 'transparent';
  const estiloDe = (superficies) => {
    const hallazgo = [...hallazgos].reverse().find((item) => superficies.some((superficie) => item.superficies?.includes(superficie)));
    if (!hallazgo)
      return {
        fill: 'rgba(255,255,255,.9)',
        stroke: '#475569',
        strokeWidth: 1.5,
      };
    if (hallazgo.codigo === 'sellante') {
      return {
        fill: 'rgba(255,255,255,.95)',
        stroke: '#475569',
        strokeWidth: 1.5,
      };
    }
    return {
      fill: colorHex(hallazgo.color),
      stroke: '#475569',
      strokeWidth: 1.5,
    };
  };
  return (
    <svg viewBox="0 0 50 50" className="h-full w-full drop-shadow" aria-hidden="true">
      <path d="M4 4H46L35 15H15Z" {...estiloDe(['vestibular'])} />
      <path d="M4 46H46L35 35H15Z" {...estiloDe([interna, 'lingual', 'palatino'])} />
      <path d="M4 4 15 15V35L4 46Z" {...estiloDe(['mesial'])} />
      <path d="M46 4 35 15V35L46 46Z" {...estiloDe(['distal'])} />
      <rect x="15" y="15" width="20" height="20" rx="3" {...estiloDe([centro, 'oclusal', 'incisal'])} />
      {superficieSellada('vestibular') && <path d="M17 9Q25 14 33 9" fill="none" stroke={colorSellante} strokeLinecap="round" strokeWidth="3" />}
      {superficieSellada(interna) && <path d="M17 41Q25 36 33 41" fill="none" stroke={colorSellante} strokeLinecap="round" strokeWidth="3" />}
      {superficieSellada('mesial') && <path d="M9 17Q14 25 9 33" fill="none" stroke={colorSellante} strokeLinecap="round" strokeWidth="3" />}
      {superficieSellada('distal') && <path d="M41 17Q36 25 41 33" fill="none" stroke={colorSellante} strokeLinecap="round" strokeWidth="3" />}
      {(superficieSellada(centro) || superficieSellada('oclusal') || superficieSellada('incisal')) && <path d="M19 25H31M25 19V31" fill="none" stroke={colorSellante} strokeLinecap="round" strokeWidth="3" />}
    </svg>
  );
}

function MarcasClinicas({ numero, hallazgos }) {
  if (!hallazgos.length) return null;
  const superior = esSuperior(numero);
  const tiene = (codigo) => hallazgos.some((item) => item.codigo === codigo);
  const hallazgosSuperficie = hallazgos.filter((item) => item.superficies?.some((superficie) => superficie !== 'raiz'));
  const hallazgoRadicular = [...hallazgos].reverse().find((item) => item.superficies?.includes('raiz'));
  const principal = hallazgos.some((item) => item.color === 'rojo') ? 'rojo' : 'azul';
  const color = colorHex(principal);
  const siglas = [...new Set(hallazgos.map((item) => item.sigla).filter(Boolean))];
  const coronaTop = superior ? '62%' : '27%';
  const raizTop = superior ? '10%' : '43%';
  const badgeTop = superior ? '1%' : '84%';

  return (
    <span className="pointer-events-none absolute inset-0 block overflow-visible">
      {hallazgosSuperficie.length > 0 && (
        <span className="absolute left-1/2 z-20 h-9 w-9 -translate-x-1/2 rounded-md bg-white/90 p-0.5 shadow-md" style={{ top: coronaTop }}>
          <MiniSuperficies hallazgos={hallazgosSuperficie} numero={numero} />
        </span>
      )}
      {hallazgoRadicular && (
        <span
          className="absolute left-[38%] right-[38%] z-10 rounded-full border-2"
          style={{
            top: raizTop,
            height: '48%',
            borderColor: colorHex(hallazgoRadicular.color),
            backgroundColor: `${colorHex(hallazgoRadicular.color)}24`,
          }}
        />
      )}
      {(tiene('corona') || tiene('corona_temporal')) && <span className="absolute left-[16%] right-[16%] z-10 h-[20%] rounded-md border-[3px]" style={{ top: coronaTop, borderColor: color }} />}
      {tiene('ausente') && (
        <svg viewBox="0 0 60 100" className="absolute inset-x-0 top-[8%] z-20 h-[72%] w-full" aria-hidden="true">
          <path d="M10 8 50 92M50 8 10 92" fill="none" stroke="#2563eb" strokeLinecap="round" strokeWidth="7" />
        </svg>
      )}
      {tiene('fractura') && (
        <svg viewBox="0 0 60 30" className="absolute left-[8%] z-20 h-[18%] w-[84%]" style={{ top: coronaTop }} aria-hidden="true">
          <path d="m2 22 12-13 10 13 12-15 10 13 12-10" fill="none" stroke="#dc2626" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        </svg>
      )}
      {tiene('edentulo_total') && <span className="absolute left-0 right-0 z-20 h-1.5 rounded-full bg-blue-600 shadow-sm" style={{ top: superior ? '72%' : '36%' }} />}
      {tiene('diastema') && (
        <span className="absolute -right-[14%] z-30 text-3xl font-black tracking-[-.2em] text-blue-600" style={{ top: coronaTop }}>
          )(
        </span>
      )}
      {(tiene('fusion') || tiene('geminacion')) && (
        <span className="absolute left-1/2 z-20 h-10 w-10 -translate-x-1/2 rounded-full border-[3px] border-blue-600" style={{ top: coronaTop }}>
          {tiene('fusion') && <span className="absolute left-4 top-[-3px] h-10 w-10 rounded-full border-[3px] border-blue-600" />}
        </span>
      )}
      {tiene('clavija') && (
        <span className="absolute left-1/2 z-20 -translate-x-1/2 text-4xl font-black text-blue-600" style={{ top: superior ? '4%' : '79%' }}>
          △
        </span>
      )}
      {tiene('transposicion') && (
        <span className="absolute left-1/2 z-20 -translate-x-1/2 text-3xl font-black text-blue-600" style={{ top: coronaTop }}>
          ⇄
        </span>
      )}
      {(tiene('ortodontico_fijo') || tiene('protesis_fija')) && (
        <svg viewBox="0 0 60 24" className="absolute left-0 z-20 h-[15%] w-full overflow-visible" style={{ top: coronaTop }} aria-hidden="true">
          <path d="M0 12H60" stroke={color} strokeWidth="4" />
          <rect x="3" y="4" width="16" height="16" rx="2" fill="white" stroke={color} strokeWidth="3" />
          <rect x="41" y="4" width="16" height="16" rx="2" fill="white" stroke={color} strokeWidth="3" />
        </svg>
      )}
      {(tiene('ortodontico_removible') || tiene('protesis_removible') || tiene('protesis_completa')) && (
        <svg viewBox="0 0 60 22" className="absolute left-0 z-20 h-[14%] w-full" style={{ top: coronaTop }} aria-hidden="true">
          <path d="m0 12 8-7 8 14 8-14 8 14 8-14 8 14 8-14 6 7" fill="none" stroke={color} strokeLinejoin="round" strokeWidth="4" />
        </svg>
      )}
      {(tiene('tratamiento_conducto') || tiene('espigo_munon') || tiene('pulpotomia')) && (
        <svg viewBox="0 0 40 90" className="absolute left-1/2 z-10 h-[55%] w-[54%] -translate-x-1/2" style={{ top: raizTop }} aria-hidden="true">
          <path d="M20 4V82" fill="none" stroke={color} strokeLinecap="round" strokeWidth="6" />
          {tiene('espigo_munon') && <rect x="12" y={superior ? '68' : '6'} width="16" height="16" rx="2" fill="white" stroke={color} strokeWidth="4" />}
        </svg>
      )}
      {tiene('implante') && (
        <svg viewBox="0 0 44 90" className="absolute left-1/2 z-10 h-[58%] w-[58%] -translate-x-1/2" style={{ top: raizTop }} aria-hidden="true">
          <path d="M22 5V82M10 19H34M12 31H32M14 43H30M16 55H28M18 67H26" fill="none" stroke={color} strokeLinecap="round" strokeWidth="4" />
        </svg>
      )}
      {tiene('giroversion') && (
        <span className="absolute left-1/2 z-20 -translate-x-1/2 text-3xl font-black text-blue-600" style={{ top: coronaTop }}>
          ↻
        </span>
      )}
      {tiene('erupcion') && (
        <span className="absolute left-1/2 z-20 -translate-x-1/2 text-3xl font-black text-blue-600" style={{ top: superior ? '35%' : '22%' }}>
          ↯
        </span>
      )}
      {tiene('extruida') && (
        <span className="absolute left-1/2 z-20 -translate-x-1/2 text-3xl font-black text-blue-600" style={{ top: superior ? '51%' : '-3%' }}>
          {superior ? '↓' : '↑'}
        </span>
      )}
      {tiene('intruida') && (
        <span className="absolute left-1/2 z-20 -translate-x-1/2 text-3xl font-black text-blue-600" style={{ top: superior ? '51%' : '-3%' }}>
          {superior ? '↑' : '↓'}
        </span>
      )}
      <span className="absolute left-1/2 z-30 flex max-w-[92%] -translate-x-1/2 justify-center gap-0.5" style={{ top: badgeTop }}>
        {siglas.slice(0, 2).map((sigla) => (
          <span key={sigla} className="rounded border border-white/70 px-1 py-0.5 text-[8px] font-black leading-none text-white shadow" style={{ backgroundColor: color }}>
            {sigla}
          </span>
        ))}
        {siglas.length > 2 && <span className="rounded bg-slate-800 px-1 text-[8px] font-black text-white">+{siglas.length - 2}</span>}
      </span>
    </span>
  );
}

function MapaPermanente({ hallazgos, seleccion, onSeleccionar, zoom }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-inner">
      <div
        className="relative mx-auto select-none"
        style={{
          width: `${zoom * 100}%`,
          minWidth: `${Math.round(980 * zoom)}px`,
          aspectRatio: '1600 / 669',
        }}
      >
        <img src={IMAGEN_ODONTOGRAMA} alt="Odontograma anatómico permanente con numeración FDI" className="absolute inset-0 h-full w-full object-contain" draggable="false" />
        {FILAS_PERMANENTES.flatMap((fila) =>
          fila.piezas.map((numero, indice) => {
            const hallazgosPieza = hallazgos.filter((item) => item.piezas.includes(numero));
            const seleccionada = seleccion.includes(numero);
            const horizontal = cajaHorizontal(fila.centros, indice);
            return (
              <button
                key={numero}
                type="button"
                onClick={(event) => onSeleccionar(numero, event)}
                aria-label={`Pieza ${numero}${hallazgosPieza.length ? `, ${hallazgosPieza.length} hallazgos` : ''}`}
                aria-pressed={seleccionada}
                title={hallazgosPieza.length ? `Pieza ${numero}: ${hallazgosPieza.map((item) => item.nombre).join(', ')}` : `Pieza ${numero}: sin hallazgos`}
                className={`absolute z-10 rounded-xl border-2 outline-none transition focus-visible:ring-4 focus-visible:ring-cyan-400/60 ${seleccionada ? 'border-cyan-500 bg-cyan-400/15 shadow-[0_0_0_3px_rgba(6,182,212,.18)]' : 'border-transparent hover:border-cyan-400/70 hover:bg-cyan-300/10'}`}
                style={{
                  ...horizontal,
                  top: `${fila.top}%`,
                  height: `${fila.height}%`,
                }}
              >
                <MarcasClinicas numero={numero} hallazgos={hallazgosPieza} />
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function PiezaDecidua({ numero, hallazgos, seleccionada, onClick }) {
  const principal = hallazgos.some((item) => item.color === 'rojo') ? 'rojo' : hallazgos.length ? 'azul' : null;
  const color = principal ? colorHex(principal) : '#94a3b8';
  return (
    <button type="button" onClick={onClick} aria-pressed={seleccionada} className={`group relative flex min-w-[68px] flex-col items-center rounded-xl border px-1 py-2 transition ${seleccionada ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/30' : 'border-slate-700 bg-slate-900/60 hover:border-cyan-500/60'}`} title={hallazgos.length ? hallazgos.map((item) => item.nombre).join(', ') : 'Sin hallazgos'}>
      <svg viewBox="0 0 52 68" className="h-14 w-12" aria-hidden="true">
        <path d="M14 5C7 10 8 22 11 32c2 8 3 27 8 30 4 2 5-16 7-20 2 4 3 22 7 20 5-3 6-22 8-30 3-10 4-22-3-27-6-4-18-4-24 0Z" fill={principal ? `${color}20` : '#f8fafc'} stroke={color} strokeWidth="2" />
        {hallazgos.some((item) => item.codigo === 'ausente') && <path d="M10 10 42 57M42 10 10 57" stroke="#2563eb" strokeWidth="4" />}
        {hallazgos.some((item) => item.codigo === 'fractura') && <path d="m10 29 10-7 7 10 14-9" fill="none" stroke="#dc2626" strokeWidth="3" />}
      </svg>
      <span className="mt-1 text-sm font-black text-slate-200">{numero}</span>
      <span className="mt-1 flex min-h-4 flex-wrap justify-center gap-0.5">
        {hallazgos.slice(0, 2).map((item, indice) => (
          <span key={`${item.codigo}-${indice}`} className="rounded px-1 text-[8px] font-black text-white" style={{ backgroundColor: colorHex(item.color) }}>
            {item.sigla || '●'}
          </span>
        ))}
      </span>
    </button>
  );
}

function ArcoDeciduo({ piezas, hallazgos, seleccion, onSeleccionar, etiqueta }) {
  return (
    <section>
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{etiqueta}</div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max justify-center gap-1.5">
          {piezas.map((numero) => (
            <PiezaDecidua key={numero} numero={numero} hallazgos={hallazgos.filter((item) => item.piezas.includes(numero))} seleccionada={seleccion.includes(numero)} onClick={(event) => onSeleccionar(numero, event)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SelectorSuperficies({ numero, superficies, onAlternar, hallazgo }) {
  const configuracion = CONFIGURACION_SUPERFICIES[hallazgo.codigo];
  if (!configuracion) {
    return (
      <div className="self-start rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h4 className="text-sm font-black text-white">Marca automática sobre la pieza</h4>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{hallazgo.nombre} no requiere elegir caras ni activar la raíz. El sistema colocará su símbolo y sigla oficial en la pieza seleccionada.</p>
      </div>
    );
  }
  const interna = numero && esSuperior(numero) ? 'palatino' : 'lingual';
  const centro = numero && esAnterior(numero) ? 'incisal' : 'oclusal';
  const activa = (superficie) => superficies.includes(superficie);
  const estilo = (superficie) => ({
    fill: activa(superficie) ? '#06b6d4' : '#0f172a',
    stroke: activa(superficie) ? '#67e8f9' : '#475569',
  });
  const tecla = (event, superficie) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAlternar(superficie);
    }
  };
  const superficiesCoronales = superficies.filter((superficie) => superficie !== 'raiz');
  return (
    <div className="grid w-full self-start content-start gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <svg viewBox="0 0 180 180" className="mx-auto h-44 w-44" aria-label="Selector de superficies dentales">
        <g role="button" aria-label="Superficie vestibular" aria-pressed={activa('vestibular')} tabIndex="0" onClick={() => onAlternar('vestibular')} onKeyDown={(event) => tecla(event, 'vestibular')} className="cursor-pointer outline-none">
          <path d="M25 25H155L122 58H58Z" {...estilo('vestibular')} strokeWidth="3" />
          <text x="90" y="46" textAnchor="middle" fill="white" fontSize="11" fontWeight="800">
            V
          </text>
        </g>
        <g role="button" aria-label={`Superficie ${interna}`} aria-pressed={activa(interna)} tabIndex="0" onClick={() => onAlternar(interna)} onKeyDown={(event) => tecla(event, interna)} className="cursor-pointer outline-none">
          <path d="M25 155H155L122 122H58Z" {...estilo(interna)} strokeWidth="3" />
          <text x="90" y="145" textAnchor="middle" fill="white" fontSize="11" fontWeight="800">
            {interna === 'palatino' ? 'P' : 'L'}
          </text>
        </g>
        <g role="button" aria-label="Superficie mesial" aria-pressed={activa('mesial')} tabIndex="0" onClick={() => onAlternar('mesial')} onKeyDown={(event) => tecla(event, 'mesial')} className="cursor-pointer outline-none">
          <path d="M25 25 58 58V122L25 155Z" {...estilo('mesial')} strokeWidth="3" />
          <text x="43" y="94" textAnchor="middle" fill="white" fontSize="11" fontWeight="800">
            M
          </text>
        </g>
        <g role="button" aria-label="Superficie distal" aria-pressed={activa('distal')} tabIndex="0" onClick={() => onAlternar('distal')} onKeyDown={(event) => tecla(event, 'distal')} className="cursor-pointer outline-none">
          <path d="M155 25 122 58V122L155 155Z" {...estilo('distal')} strokeWidth="3" />
          <text x="137" y="94" textAnchor="middle" fill="white" fontSize="11" fontWeight="800">
            D
          </text>
        </g>
        <g role="button" aria-label={`Superficie ${centro}`} aria-pressed={activa(centro)} tabIndex="0" onClick={() => onAlternar(centro)} onKeyDown={(event) => tecla(event, centro)} className="cursor-pointer outline-none">
          <rect x="58" y="58" width="64" height="64" rx="10" {...estilo(centro)} strokeWidth="3" />
          <text x="90" y="95" textAnchor="middle" fill="white" fontSize="11" fontWeight="800">
            {centro === 'incisal' ? 'I' : 'O'}
          </text>
        </g>
      </svg>
      <div>
        <h4 className="text-sm font-black text-white">Superficies comprometidas</h4>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{configuracion.ayuda} La cara interna cambia automáticamente entre palatino y lingual según la pieza activa.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {superficiesCoronales.map((superficie) => (
            <button key={superficie} type="button" onClick={() => onAlternar(superficie)} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-300">
              {NOMBRES_SUPERFICIES[superficie] || superficie} ×
            </button>
          ))}
          {configuracion.permiteRaiz && (
            <button type="button" aria-pressed={activa('raiz')} onClick={() => onAlternar('raiz')} className={`rounded-full border px-2 py-1 text-[10px] font-bold ${activa('raiz') ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-600 text-slate-400'}`}>
              {activa('raiz') ? '✓ Compromiso radicular' : 'Compromiso radicular'}
            </button>
          )}
          {!superficies.length && <span className="py-1 text-[10px] text-slate-500">Ninguna superficie seleccionada</span>}
        </div>
      </div>
    </div>
  );
}

export default function OdontogramaPanelInteractivo({ paciente }) {
  const pacienteId = paciente?.id;
  const [registros, setRegistros] = useState([]);
  const [registroVisible, setRegistroVisible] = useState(null);
  const [editando, setEditando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [denticion, setDenticion] = useState('permanente');
  const [motivo, setMotivo] = useState('evaluacion_inicial');
  const [seleccion, setSeleccion] = useState([]);
  const [piezaActiva, setPiezaActiva] = useState(null);
  const [hallazgos, setHallazgos] = useState([]);
  const [form, setForm] = useState(formularioInicial());
  const [especificaciones, setEspecificaciones] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [busquedaHallazgo, setBusquedaHallazgo] = useState('');
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [zoom, setZoom] = useState(1);

  const cargar = useCallback(async () => {
    if (!pacienteId) return;
    setCargando(true);
    try {
      const datos = await api.getOdontogramas(pacienteId);
      setRegistros(datos || []);
      setRegistroVisible(datos?.[0] || null);
      if (!datos?.length) setEditando(true);
    } catch (error) {
      Swal.fire({
        title: 'No se pudo cargar el odontograma',
        text: error.message,
        icon: 'error',
        background: '#1e293b',
        color: '#fff',
      });
    } finally {
      setCargando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hallazgosMostrados = editando ? hallazgos : registroVisible?.hallazgos || [];
  const tipoActual = HALLAZGOS.find((item) => item.codigo === form.codigo) || HALLAZGOS[0];
  const hallazgosPiezaActiva = piezaActiva ? hallazgosMostrados.filter((item) => item.piezas.includes(piezaActiva)) : [];
  const resumen = hallazgosMostrados.reduce((acc, item) => {
    acc[item.color] = (acc[item.color] || 0) + 1;
    return acc;
  }, {});
  const hallazgosFiltrados = useMemo(() => {
    const termino = busquedaHallazgo.trim().toLocaleLowerCase('es');
    if (!termino) return HALLAZGOS;
    return HALLAZGOS.filter((item) => `${item.nombre} ${item.sigla} ${item.categoria}`.toLocaleLowerCase('es').includes(termino));
  }, [busquedaHallazgo]);
  const opcionesSigla = SIGLAS_POR_HALLAZGO[tipoActual.codigo] || [];

  const cambiarTipo = (codigo) => {
    const hallazgo = HALLAZGOS.find((item) => item.codigo === codigo) || HALLAZGOS[0];
    setForm(formularioInicial(hallazgo));
  };
  const seleccionarPieza = (numero, event) => {
    if (!editando) {
      setPiezaActiva(numero);
      return;
    }

    let siguiente;
    if (event?.shiftKey && piezaActiva) {
      const fila = [...PERMANENTES, ...DECIDUAS].find((grupo) => grupo.includes(numero) && grupo.includes(piezaActiva));
      if (fila) {
        const inicio = fila.indexOf(piezaActiva);
        const fin = fila.indexOf(numero);
        const rango = fila.slice(Math.min(inicio, fin), Math.max(inicio, fin) + 1);
        siguiente = ordenarPiezas([...new Set([...seleccion, ...rango])]);
      }
    }
    if (!siguiente) {
      siguiente = seleccion.includes(numero) ? seleccion.filter((item) => item !== numero) : ordenarPiezas([...seleccion, numero]);
    }

    setSeleccion(siguiente);
    setPiezaActiva(siguiente.includes(numero) ? numero : siguiente.at(-1) || null);
  };
  const seleccionarGrupo = (grupo) => {
    setSeleccion((actual) => ordenarPiezas([...new Set([...actual, ...grupo])]));
    setPiezaActiva(grupo[0]);
  };
  const alternarSuperficie = (superficie) =>
    setForm((actual) => ({
      ...actual,
      superficies: actual.superficies.includes(superficie) ? actual.superficies.filter((item) => item !== superficie) : [...actual.superficies, superficie],
    }));
  const agregarHallazgo = () => {
    if (!seleccion.length)
      return Swal.fire({
        title: 'Selecciona una o más piezas',
        text: 'Haz clic directamente sobre los dientes del odontograma.',
        icon: 'info',
        background: '#1e293b',
        color: '#fff',
      });
    setHallazgos((actuales) => [
      ...actuales,
      {
        codigo: tipoActual.codigo,
        nombre: tipoActual.nombre,
        piezas: [...seleccion],
        sigla: form.sigla.trim().toUpperCase(),
        color: tipoActual.color === 'variable' ? form.color : tipoActual.color,
        superficies: form.superficies,
        detalle: form.detalle.trim(),
      },
    ]);
    setSeleccion([]);
    setForm(formularioInicial(tipoActual));
  };
  const nuevoRegistro = () => {
    const base = registroVisible || registros[0];
    setDenticion(base?.denticion || 'permanente');
    setHallazgos(
      (base?.hallazgos || []).map((item) => ({
        ...item,
        piezas: [...item.piezas],
        superficies: [...(item.superficies || [])],
      })),
    );
    setEspecificaciones(base?.especificaciones || '');
    setObservaciones('');
    setMotivo(registros.length ? 'nuevo_hallazgo' : 'evaluacion_inicial');
    setSeleccion([]);
    setPiezaActiva(null);
    setEditando(true);
  };
  const guardar = async () => {
    const confirmacion = await Swal.fire({
      title: 'Guardar versión inalterable',
      text: 'Después de guardarla no podrá editarse ni eliminarse. Los cambios futuros se registrarán en una nueva versión.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Guardar odontograma',
      cancelButtonText: 'Seguir revisando',
      background: '#1e293b',
      color: '#fff',
    });
    if (!confirmacion.isConfirmed) return;
    try {
      setGuardando(true);
      await api.crearOdontograma({
        pacienteId,
        motivo,
        denticion,
        hallazgos,
        especificaciones,
        observaciones,
      });
      setEditando(false);
      setPiezaActiva(null);
      await cargar();
      Swal.fire({
        title: 'Odontograma guardado',
        text: 'La versión clínica quedó protegida en el historial.',
        icon: 'success',
        background: '#1e293b',
        color: '#fff',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        title: 'No se pudo guardar',
        text: error.message,
        icon: 'error',
        background: '#1e293b',
        color: '#fff',
      });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="py-16 text-center text-slate-500">Cargando odontograma…</div>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-cyan-400" size={20} />
            <div>
              <h3 className="font-black text-white">Odontograma clínico interactivo · NTS 188-MINSA/DGIESP-2022</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Registra hallazgos observados con numeración FDI, superficies, siglas y marcas gráficas. Azul = buen estado o no patológico; rojo = mal estado, temporal o patológico.</p>
            </div>
          </div>
        </section>
        <section className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-center text-xs">
          <div className="rounded-xl bg-blue-500/10 p-2">
            <b className="block text-xl text-blue-400">{resumen.azul || 0}</b>
            <span className="text-slate-400">Azules</span>
          </div>
          <div className="rounded-xl bg-red-500/10 p-2">
            <b className="block text-xl text-red-400">{resumen.rojo || 0}</b>
            <span className="text-slate-400">Rojos</span>
          </div>
          <div className="rounded-xl bg-cyan-500/10 p-2">
            <b className="block text-xl text-cyan-300">{new Set(hallazgosMostrados.flatMap((item) => item.piezas)).size}</b>
            <span className="text-slate-400">Piezas</span>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {registros.map((registro, indice) => (
            <button
              key={registro.id}
              type="button"
              disabled={editando}
              onClick={() => {
                setRegistroVisible(registro);
                setDenticion(registro.denticion);
                setPiezaActiva(null);
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-bold ${registroVisible?.id === registro.id && !editando ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-400'}`}
            >
              v{registros.length - indice} · {fechaLegible(registro.creadoEn)}
            </button>
          ))}
        </div>
        {!editando && (
          <button type="button" onClick={nuevoRegistro} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white">
            <ClipboardPlus size={16} />
            Nuevo odontograma
          </button>
        )}
      </div>

      {editando && (
        <div className="grid gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 md:grid-cols-3">
          <label className="text-xs font-bold text-slate-400">
            Motivo
            <select value={motivo} onChange={(event) => setMotivo(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white">
              {Object.entries(MOTIVOS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-400">
            Dentición
            <select
              value={denticion}
              onChange={(event) => {
                setDenticion(event.target.value);
                setSeleccion([]);
                setPiezaActiva(null);
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"
            >
              <option value="permanente">Permanente</option>
              <option value="decidua">Decidua</option>
              <option value="mixta">Mixta</option>
            </select>
          </label>
          <div className="flex items-end">
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-amber-200">
              <MousePointer2 size={14} className="mr-1 inline" />
              Clic para seleccionar. Mayús + clic selecciona un rango de piezas del mismo arco.
            </div>
          </div>
        </div>
      )}

      {editando && (
        <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-black text-white">
                <Sparkles size={17} className="text-cyan-400" />
                1. Elige el hallazgo
              </h3>
              <p className="mt-1 text-xs text-slate-500">Accesos rápidos a los registros más usados.</p>
            </div>
            <button type="button" onClick={() => setMostrarTodos((valor) => !valor)} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-slate-300">
              {mostrarTodos ? 'Ocultar catálogo' : 'Ver los 38 hallazgos'} <ChevronDown size={14} className={mostrarTodos ? 'rotate-180' : ''} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {HALLAZGOS_FRECUENTES.map((codigo) => {
              const item = HALLAZGOS.find((hallazgo) => hallazgo.codigo === codigo);
              return (
                <button key={codigo} type="button" onClick={() => cambiarTipo(codigo)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${form.codigo === codigo ? 'border-cyan-400 bg-cyan-500/15 text-white ring-2 ring-cyan-400/15' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500'}`}>
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black text-white"
                    style={{
                      backgroundColor: colorHex(item.color === 'variable' ? 'azul' : item.color),
                    }}
                  >
                    {item.sigla || (codigo === 'fractura' ? '⌁' : '●')}
                  </span>
                  <span>
                    <b className="block text-xs">{item.nombre}</b>
                    <small className="mt-0.5 block text-[9px] uppercase tracking-wide text-slate-500">{item.categoria}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {mostrarTodos && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input value={busquedaHallazgo} onChange={(event) => setBusquedaHallazgo(event.target.value)} placeholder="Buscar caries, prótesis, posición…" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-500" />
              </div>
              <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {hallazgosFiltrados.map((item) => (
                  <button key={item.codigo} type="button" onClick={() => cambiarTipo(item.codigo)} className={`rounded-lg px-3 py-2 text-left text-xs ${form.codigo === item.codigo ? 'bg-cyan-600 font-black text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                    <span className="mr-2 text-[9px] uppercase text-slate-500">{item.categoria}</span>
                    {item.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-black text-white">
              {editando ? '2. Selecciona las piezas' : 'Explorar odontograma'} <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">FDI</span>
            </h3>
            <p className="mt-1 text-xs text-slate-500">{editando ? `${seleccion.length} pieza(s) seleccionada(s): ${seleccion.join(', ') || 'ninguna'}` : 'Haz clic en una pieza para consultar sus hallazgos.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {editando && denticion !== 'decidua' && (
              <>
                <button type="button" onClick={() => seleccionarGrupo(PERMANENTES[0])} className="rounded-lg border border-slate-600 px-2 py-1.5 text-[10px] font-bold text-slate-300">
                  Maxilar superior
                </button>
                <button type="button" onClick={() => seleccionarGrupo(PERMANENTES[1])} className="rounded-lg border border-slate-600 px-2 py-1.5 text-[10px] font-bold text-slate-300">
                  Mandíbula
                </button>
              </>
            )}
            {editando && (
              <button
                type="button"
                onClick={() => {
                  setSeleccion([]);
                  setPiezaActiva(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1.5 text-[10px] font-bold text-slate-400"
              >
                <Eraser size={12} />
                Limpiar
              </button>
            )}
            <span className="mx-1 h-5 w-px bg-slate-700" />
            <button type="button" onClick={() => setZoom((valor) => Math.max(0.8, Number((valor - 0.1).toFixed(1))))} className="rounded-lg border border-slate-600 p-1.5 text-slate-400" aria-label="Alejar">
              <ZoomOut size={15} />
            </button>
            <button type="button" onClick={() => setZoom(1)} className="min-w-12 rounded-lg border border-slate-600 px-2 py-1.5 text-[10px] font-bold text-slate-400">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={() => setZoom((valor) => Math.min(1.3, Number((valor + 0.1).toFixed(1))))} className="rounded-lg border border-slate-600 p-1.5 text-slate-400" aria-label="Acercar">
              <ZoomIn size={15} />
            </button>
          </div>
        </div>
        {(denticion === 'permanente' || denticion === 'mixta') && <MapaPermanente hallazgos={hallazgosMostrados} seleccion={seleccion} onSeleccionar={seleccionarPieza} zoom={zoom} />}
        {(denticion === 'decidua' || denticion === 'mixta') && (
          <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/40 p-3">
            <ArcoDeciduo piezas={DECIDUAS[0]} hallazgos={hallazgosMostrados} seleccion={seleccion} onSeleccionar={seleccionarPieza} etiqueta="Dentición decidua · maxilar superior" />
            <ArcoDeciduo piezas={DECIDUAS[1]} hallazgos={hallazgosMostrados} seleccion={seleccion} onSeleccionar={seleccionarPieza} etiqueta="Dentición decidua · mandíbula" />
          </div>
        )}
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-[10px] font-bold text-slate-400">
          <span className="mr-1 text-slate-300">Leyenda:</span>
          <span className="text-blue-400">● Azul · buen estado/no patológico</span>
          <span className="text-red-400">● Rojo · mal estado/temporal/patológico</span>
          <span>
            <b className="text-blue-400">╳</b> Ausente
          </span>
          <span>
            <b className="text-red-400">⌁</b> Fractura
          </span>
          <span>
            <b className="text-blue-400">│</b> Conducto
          </span>
          <span>
            <b className="text-blue-400">□</b> Corona
          </span>
        </div>
      </section>

      {piezaActiva && (
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-black text-white">
                <Eye size={17} className="text-cyan-400" />
                Pieza {piezaActiva}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{hallazgosPiezaActiva.length ? `${hallazgosPiezaActiva.length} hallazgo(s) en la versión visible.` : 'Sin hallazgos registrados en esta versión.'}</p>
            </div>
          </div>
          {hallazgosPiezaActiva.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {hallazgosPiezaActiva.map((item, indice) => (
                <div key={`${item.codigo}-${indice}`} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorHex(item.color) }} />
                  <div>
                    <b className="text-xs text-white">
                      {item.nombre}
                      {item.sigla ? ` · ${item.sigla}` : ''}
                    </b>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {item.superficies?.length ? item.superficies.map((superficie) => NOMBRES_SUPERFICIES[superficie] || superficie).join(', ') : 'Pieza completa'}
                      {item.detalle ? ` · ${item.detalle}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {editando && (
        <section className="rounded-2xl border border-cyan-500/20 bg-slate-800/70 p-4">
          <div className="mb-4">
            <h3 className="font-black text-white">3. Define la marca y aplícala</h3>
            <p className="mt-1 text-xs text-slate-500">
              Hallazgo: <b className="text-cyan-300">{tipoActual.nombre}</b> · Pieza(s): <b className="text-white">{seleccion.join(', ') || 'sin seleccionar'}</b>
            </p>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)]">
            <SelectorSuperficies numero={piezaActiva || seleccion[0]} superficies={form.superficies} onAlternar={alternarSuperficie} hallazgo={tipoActual} />
            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              {opcionesSigla.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-bold text-slate-400">Siglas oficiales frecuentes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {opcionesSigla.map((sigla) => (
                      <button key={sigla} type="button" onClick={() => setForm((actual) => ({ ...actual, sigla }))} className={`rounded-lg border px-2.5 py-1.5 text-xs font-black ${form.sigla === sigla ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-600 text-slate-400'}`}>
                        {sigla}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="block text-xs font-bold text-slate-400">
                Sigla o nomenclatura
                <input
                  value={form.sigla}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      sigla: event.target.value.toUpperCase(),
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white"
                  placeholder="Según el hallazgo NTS"
                />
              </label>
              {tipoActual.color === 'variable' ? (
                <div>
                  <div className="mb-2 text-xs font-bold text-slate-400">Estado clínico</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setForm((actual) => ({ ...actual, color: 'azul' }))} className={`rounded-xl border p-2 text-xs font-black ${form.color === 'azul' ? 'border-blue-400 bg-blue-500/20 text-blue-200' : 'border-slate-700 text-slate-500'}`}>
                      Azul · buen estado
                    </button>
                    <button type="button" onClick={() => setForm((actual) => ({ ...actual, color: 'rojo' }))} className={`rounded-xl border p-2 text-xs font-black ${form.color === 'rojo' ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-slate-700 text-slate-500'}`}>
                      Rojo · mal estado
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border p-2 text-xs font-bold"
                  style={{
                    borderColor: `${colorHex(tipoActual.color)}70`,
                    color: colorHex(tipoActual.color),
                    backgroundColor: `${colorHex(tipoActual.color)}12`,
                  }}
                >
                  Color establecido por la NTS: {tipoActual.color}.
                </div>
              )}
              <label className="block text-xs font-bold text-slate-400">
                Detalle clínico
                <textarea
                  rows="2"
                  value={form.detalle}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      detalle: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white"
                  placeholder="Forma, extensión, grado u otra precisión…"
                />
              </label>
              <button type="button" onClick={agregarHallazgo} disabled={!seleccion.length} className="w-full rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40">
                Aplicar marca a {seleccion.length || 0} pieza(s)
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-black text-white">
            <History size={17} className="text-cyan-400" />
            Hallazgos de esta versión
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{hallazgosMostrados.length} registro(s)</span>
            {editando && hallazgos.length > 0 && (
              <button type="button" onClick={() => setHallazgos((actuales) => actuales.slice(0, -1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-[10px] font-bold text-slate-400">
                <Undo2 size={12} />
                Deshacer último
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {hallazgosMostrados.length ? (
            hallazgosMostrados.map((item, indice) => (
              <div key={`${item.codigo}-${indice}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setPiezaActiva(item.piezas[0]);
                    if (editando) setSeleccion(ordenarPiezas(item.piezas));
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorHex(item.color) }} />
                    <b className="text-sm text-white">{item.nombre}</b>
                    {item.sigla && <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] font-black text-slate-300">{item.sigla}</span>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Pieza(s): {item.piezas.join(', ')}
                    {item.superficies?.length ? ` · ${item.superficies.map((superficie) => NOMBRES_SUPERFICIES[superficie] || superficie).join(', ')}` : ''}
                  </div>
                  {item.detalle && <div className="mt-1 text-xs text-slate-500">{item.detalle}</div>}
                </button>
                {editando && (
                  <button type="button" onClick={() => setHallazgos((actuales) => actuales.filter((_, posicion) => posicion !== indice))} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-slate-500">Sin hallazgos clínicos registrados.</div>
          )}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-400">
          Especificaciones
          <textarea readOnly={!editando} rows="3" value={editando ? especificaciones : registroVisible?.especificaciones || ''} onChange={(event) => setEspecificaciones(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white read-only:opacity-70" placeholder="Características adicionales por falta de espacio…" />
        </label>
        <label className="text-xs font-bold text-slate-400">
          Observaciones
          <textarea readOnly={!editando} rows="3" value={editando ? observaciones : registroVisible?.observaciones || ''} onChange={(event) => setObservaciones(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white read-only:opacity-70" placeholder="Hallazgos no contemplados en la nomenclatura…" />
        </label>
      </div>

      {editando ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={!registros.length}
            onClick={() => {
              setEditando(false);
              setSeleccion([]);
              setPiezaActiva(null);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-600 px-4 py-2.5 text-xs font-bold text-slate-300 disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Cancelar borrador
          </button>
          <button type="button" disabled={guardando} onClick={guardar} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">
            <Save size={16} />
            {guardando ? 'Guardando…' : 'Guardar versión inalterable'}
          </button>
        </div>
      ) : (
        registroVisible && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={15} />
              Registrado por {registroVisible.profesionalNombre} · {fechaLegible(registroVisible.creadoEn)}
            </span>
            <span>{MOTIVOS[registroVisible.motivo] || registroVisible.motivo}</span>
          </div>
        )
      )}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-[10px] leading-relaxed text-slate-500">
        <Info size={13} className="mr-1 inline" />
        Este odontograma registra hallazgos clínicos observados. Los procedimientos por realizar pertenecen al plan de tratamiento. Las marcas gráficas ayudan a la lectura, pero la sigla y el detalle conservan la precisión clínica y legal.
      </div>
    </div>
  );
}
