import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FinanzasPage from './FinanzasPage';

describe('FinanzasPage', () => {
  it('conserva el resumen clásico y abre el reporte detallado por separado', () => {
    render(
      <FinanzasPage
        pagos={[]}
        pagosFiltrados={[]}
        busqueda=""
        filtro="todos"
        resumen={{
          totalCobrado: 100,
          ingresosMes: 80,
          financiadoActivo: 50,
          porCobrarTotal: 25
        }}
        movimientos={[]}
        pacientes={[]}
        onCambiarBusqueda={vi.fn()}
        onCambiarFiltro={vi.fn()}
        onCobrar={vi.fn()}
        formatearMoneda={(valor) => `S/. ${Number(valor).toFixed(2)}`}
      />
    );

    expect(screen.getByText('Total Cobrado')).toBeInTheDocument();
    expect(screen.getByText('Ingresos del Mes')).toBeInTheDocument();
    expect(screen.getByText('Financiado Activo')).toBeInTheDocument();
    expect(screen.getByText('Por Cobrar')).toBeInTheDocument();
    expect(
      screen.queryByText('Reporte de ingresos y egresos')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver ingresos y egresos' })
    );
    expect(screen.getByText('Reporte de ingresos y egresos')).toBeInTheDocument();
  });
});
