import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgendaClinicaProfesional from './AgendaClinicaProfesional';

describe('AgendaClinicaProfesional', () => {
  afterEach(() => vi.useRealTimers());

  it('actualiza inmediatamente el panel abierto al recibir al paciente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T08:00:00'));
    const cambiarEstado = vi.fn();

    render(
      <AgendaClinicaProfesional
        citas={[
          {
            id: 10,
            pacienteId: 5,
            fecha: '2026-08-15',
            hora: '09:00',
            horaFin: '10:00',
            estado: 'pendiente',
            procedimiento: 'Consulta',
            costo: 0
          }
        ]}
        pacientes={[
          {
            id: 5,
            nombre: 'Carlos Prueba',
            codigo_ficha: '05',
            telefono: '999999999'
          }
        ]}
        pagos={[]}
        onCambiarEstado={cambiarEstado}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Carlos Prueba' }));
    const botonesRecibir = screen.getAllByRole('button', {
      name: 'Recibir paciente'
    });
    fireEvent.click(botonesRecibir.at(-1));

    expect(cambiarEstado).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10 }),
      'en_espera'
    );
    expect(
      screen.getByRole('button', { name: 'Iniciar atención' })
    ).toBeInTheDocument();
  });
});
