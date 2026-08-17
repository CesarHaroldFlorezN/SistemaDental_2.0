import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calcularResumenFinanzas,
  construirMovimientosCaja,
  filtrarMovimientosCajaPorPeriodo
} from './selectores';

describe('resumen financiero por períodos', () => {
  afterEach(() => vi.useRealTimers());

  it('separa día, semana, mes, año e histórico usando movimientos netos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T16:00:00-05:00'));

    const pagos = [
      { id: 1, cobrado: 80, saldo: 20, tipoPago: 'anticipo' },
      {
        id: 2,
        cobrado: 40,
        saldo: 0,
        tipoPago: 'completo',
        fechaUltPago: '2025-12-20'
      }
    ];
    const movimientos = [
      {
        pagoId: 1,
        abono: 100,
        cargo: 0,
        creadoEn: '2026-08-15T09:00:00-05:00'
      },
      {
        pagoId: 1,
        abono: 0,
        cargo: 20,
        creadoEn: '2026-08-15T10:00:00-05:00'
      }
    ];

    const resumen = calcularResumenFinanzas(pagos, movimientos);

    expect(resumen.ingresosHoy).toBe(80);
    expect(resumen.ingresosSemana).toBe(80);
    expect(resumen.ingresosMes).toBe(80);
    expect(resumen.ingresosAnio).toBe(80);
    expect(resumen.ingresosHistoricos).toBe(120);
    expect(resumen.totalCobrado).toBe(120);
  });

  it('conserva por separado los ingresos, egresos y pagos históricos', () => {
    const pagos = [
      {
        id: 1,
        pacienteId: 8,
        cobrado: 80,
        concepto: 'Consulta'
      },
      {
        id: 2,
        pacienteId: 8,
        cobrado: 25,
        concepto: 'Pago antiguo',
        fechaUltPago: '2025-01-10'
      }
    ];
    const movimientos = [
      {
        id: 10,
        pagoId: 1,
        pacienteId: 8,
        tipo: 'pago',
        descripcion: 'Pago de consulta',
        abono: 100,
        cargo: 0,
        creadoEn: '2026-08-15T09:00:00'
      },
      {
        id: 11,
        pagoId: 1,
        pacienteId: 8,
        tipo: 'devolucion',
        descripcion: 'Devolución parcial',
        abono: 0,
        cargo: 20,
        creadoEn: '2026-08-15T10:00:00'
      }
    ];

    const caja = construirMovimientosCaja(pagos, movimientos, [
      { id: 8, nombre: 'Paciente Ejemplo', codigo_ficha: '08' }
    ]);

    expect(caja).toHaveLength(3);
    expect(caja.find((item) => item.tipo === 'pago')).toMatchObject({
      nombrePaciente: 'Paciente Ejemplo',
      ingreso: 100,
      egreso: 0
    });
    expect(caja.find((item) => item.tipo === 'devolucion')).toMatchObject({
      ingreso: 0,
      egreso: 20
    });
    expect(caja.find((item) => item.tipo === 'pago_anterior')).toMatchObject({
      ingreso: 25,
      egreso: 0
    });

    const hoy = filtrarMovimientosCajaPorPeriodo(
      caja,
      'hoy',
      new Date('2026-08-15T12:00:00')
    );
    expect(hoy).toHaveLength(2);
  });
});
