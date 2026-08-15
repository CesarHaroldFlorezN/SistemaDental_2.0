import { describe, expect, it } from 'vitest';
import {
  puedeAccederVista,
  resolverRutaApp,
  rutaDeVista,
  rutaPaciente
} from './rutas';

describe('rutas de DentalPro', () => {
  it('resuelve módulos y enlaces directos a pacientes', () => {
    expect(rutaDeVista('planpagos')).toBe('/planes-pago');
    expect(rutaPaciente(1775)).toBe('/pacientes/1775');
    expect(resolverRutaApp('/pacientes/1775')).toEqual({
      vista: 'pacientes',
      pacienteId: 1775
    });
  });

  it('respeta la jerarquía de acceso por rol', () => {
    expect(puedeAccederVista('catalogo', 'administrador')).toBe(true);
    expect(puedeAccederVista('catalogo', 'recepcion')).toBe(false);
    expect(puedeAccederVista('planes', 'odontologo')).toBe(true);
  });
});
