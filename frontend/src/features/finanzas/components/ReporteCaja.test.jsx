import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReporteCaja from './ReporteCaja';

const moneda = (valor) => `S/. ${Number(valor).toFixed(2)}`;

describe('ReporteCaja', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra ingresos y egresos del período y permite consultar el histórico', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00'));

    render(
      <ReporteCaja
        pagos={[
          { id: 1, pacienteId: 5, cobrado: 80, concepto: 'Consulta' },
          {
            id: 2,
            pacienteId: 5,
            cobrado: 30,
            concepto: 'Pago anterior',
            fechaUltPago: '2025-03-10'
          }
        ]}
        movimientos={[
          {
            id: 10,
            pagoId: 1,
            pacienteId: 5,
            tipo: 'pago',
            descripcion: 'Pago recibido',
            abono: 100,
            cargo: 0,
            creadoEn: '2026-08-15T09:00:00'
          },
          {
            id: 11,
            pagoId: 1,
            pacienteId: 5,
            tipo: 'devolucion',
            descripcion: 'Devolución al paciente',
            abono: 0,
            cargo: 20,
            creadoEn: '2026-08-15T10:00:00'
          }
        ]}
        pacientes={[{ id: 5, nombre: 'Ana Prueba', codigo_ficha: '05' }]}
        formatearMoneda={moneda}
      />
    );

    expect(screen.getByText('Pago recibido')).toBeInTheDocument();
    expect(screen.getByText('Devolución al paciente')).toBeInTheDocument();
    expect(screen.queryByText('Pago anterior: Pago anterior')).not.toBeInTheDocument();
    expect(screen.getAllByText('S/. 100.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S/. 20.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S/. 80.00').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Desde el inicio' }));
    expect(screen.getByText('Pago anterior: Pago anterior')).toBeInTheDocument();
  });
});
