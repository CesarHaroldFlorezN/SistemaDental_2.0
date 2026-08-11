import { Palette } from 'lucide-react';
import { TEMAS_VISUALES } from '../themeConfig.js';

export default function ThemeSelector({ tema, onChange }) {
  const indiceActivo = Math.max(
    0,
    TEMAS_VISUALES.findIndex((opcion) => opcion.id === tema)
  );
  const opcionActiva = TEMAS_VISUALES[indiceActivo];

  return (
    <section
      className="dp-theme-selector"
      aria-label="Selector de tema visual"
    >
      <div className="dp-theme-selector-heading">
        <span className="dp-theme-selector-kicker">
          <Palette size={14} />
          Tema visual
        </span>
        <span className="dp-theme-selector-current">
          {opcionActiva.nombre}
        </span>
      </div>

      <div
        className="dp-theme-track"
        role="radiogroup"
        aria-label="Paletas disponibles"
        style={{ '--dp-theme-offset': `${indiceActivo * 100}%` }}
      >
        <span className="dp-theme-thumb" aria-hidden="true" />

        {TEMAS_VISUALES.map((opcion) => {
          const activa = opcion.id === opcionActiva.id;

          return (
            <button
              key={opcion.id}
              type="button"
              role="radio"
              aria-checked={activa}
              aria-label={`${opcion.nombre}: ${opcion.descripcion}`}
              title={`${opcion.nombre} · ${opcion.descripcion}`}
              onClick={() => onChange(opcion.id)}
              className="dp-theme-point"
              style={{
                '--dp-theme-dot': opcion.primario,
                '--dp-theme-dot-secondary': opcion.secundario,
                '--dp-theme-dot-accent': opcion.acento
              }}
            >
              <span className="dp-theme-point-swatch" aria-hidden="true" />
              <span>{opcion.codigo}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
