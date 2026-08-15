import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PacientesPage from './PacientesPage';

describe('directorio de pacientes', () => {
  it('expone importación, exportación y búsqueda como controles accesibles', () => {
    const onExportar = vi.fn();
    const onCambiarBusqueda = vi.fn();
    render(
      <PacientesPage
        pacientes={[]}
        busqueda=""
        onCambiarBusqueda={onCambiarBusqueda}
        onExportar={onExportar}
        onImportar={vi.fn()}
        onNuevo={vi.fn()}
        onVerFicha={vi.fn()}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }));
    fireEvent.change(screen.getByPlaceholderText(/buscar por ficha/i), {
      target: { value: 'DNI 123' }
    });

    expect(onExportar).toHaveBeenCalledOnce();
    expect(onCambiarBusqueda).toHaveBeenCalledWith('DNI 123');
    expect(screen.getByText(/importar csv/i)).toBeInTheDocument();
  });
});
