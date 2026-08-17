import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AgendaMiniPreview from './AgendaMiniPreview';

describe('vista previa de agenda al programar', () => {
  it('muestra mes, semana y día sin controles de edición', () => {
    render(
      <AgendaMiniPreview
        fecha="2026-08-15"
        hora="09:00"
        horaFin="10:00"
        pacientes={[{ id: 1, nombre: 'Paciente existente' }]}
        citas={[
          {
            id: 7,
            pacienteId: 1,
            fecha: '2026-08-15',
            hora: '11:00',
            horaFin: '12:00',
            estado: 'pendiente'
          }
        ]}
      />
    );

    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    expect(screen.getByText('Nueva atención')).toBeInTheDocument();
    expect(screen.getByText('Paciente existente')).toBeInTheDocument();
    expect(screen.queryByText(/editar horarios/i)).not.toBeInTheDocument();
  });
});
