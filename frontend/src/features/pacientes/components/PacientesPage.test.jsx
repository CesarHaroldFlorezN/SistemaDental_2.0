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

  it('permite limpiar una búsqueda completa con un solo botón', () => {
    const onCambiarBusqueda = vi.fn();
    render(
      <PacientesPage
        pacientes={[]}
        busqueda="María 12345678"
        onCambiarBusqueda={onCambiarBusqueda}
        onExportar={vi.fn()}
        onImportar={vi.fn()}
        onNuevo={vi.fn()}
        onVerFicha={vi.fn()}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /limpiar búsqueda/i }));

    expect(onCambiarBusqueda).toHaveBeenCalledWith('');
  });

  it('divide un directorio grande en páginas manejables', () => {
    const pacientes = Array.from({ length: 30 }, (_, indice) => ({
      id: indice + 1,
      codigo_ficha: `F-${indice + 1}`,
      nombre: `Paciente ${indice + 1}`,
      cedula: `DNI-${indice + 1}`,
      telefono: '999999999'
    }));

    render(
      <PacientesPage
        pacientes={pacientes}
        busqueda=""
        onCambiarBusqueda={vi.fn()}
        onExportar={vi.fn()}
        onImportar={vi.fn()}
        onNuevo={vi.fn()}
        onVerFicha={vi.fn()}
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
      />
    );

    expect(screen.getByText('Paciente 1')).toBeInTheDocument();
    expect(screen.queryByText('Paciente 30')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(screen.getByText('Paciente 30')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });
});
