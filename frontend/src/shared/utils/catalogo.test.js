import { describe, expect, it } from 'vitest';
import {
  buscarServicioCatalogo,
  normalizarTextoCatalogo,
  serviciosCatalogoDisponibles
} from './catalogo';

const catalogo = [
  {
    id: 10,
    codigo: 'ortodoncia-colocacion',
    nombre: 'Ortodoncia — colocación',
    categoria: 'Ortodoncia',
    precio: '300.00',
    activo: true
  },
  {
    id: 11,
    codigo: 'profilaxis-limpieza',
    nombre: 'Profilaxis / Limpieza dental',
    categoria: 'Prevención',
    precio: '90.00',
    activo: false
  }
];

describe('catálogo canónico de servicios', () => {
  it('iguala tildes, signos y variantes históricas', () => {
    expect(normalizarTextoCatalogo('Ortodoncia — colocación')).toBe(
      'ortodoncia colocacion'
    );
    expect(
      buscarServicioCatalogo(catalogo, {
        nombre: 'Ortodoncia - colocacion'
      })?.id
    ).toBe(10);
  });

  it('mantiene visible un servicio inactivo ya guardado', () => {
    expect(serviciosCatalogoDisponibles(catalogo)).toHaveLength(1);
    expect(serviciosCatalogoDisponibles(catalogo, 11)).toHaveLength(2);
  });
});
