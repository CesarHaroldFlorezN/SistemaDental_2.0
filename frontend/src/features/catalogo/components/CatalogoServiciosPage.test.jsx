import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogoServiciosPage from './CatalogoServiciosPage';
import { api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  api: {
    crearServicioCatalogo: vi.fn(),
    actualizarServicioCatalogo: vi.fn()
  }
}));

const servicios = [
  {
    id: 1,
    codigo: 'consulta-evaluacion',
    nombre: 'Consulta de evaluación',
    categoria: 'Diagnóstico',
    precio: '80.00',
    activo: true
  }
];

describe('gestión del catálogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea un servicio con nombre, categoría y precio', async () => {
    api.crearServicioCatalogo.mockResolvedValue({ id: 2 });
    const onRecargar = vi.fn().mockResolvedValue([]);
    render(
      <CatalogoServiciosPage
        servicios={servicios}
        onRecargar={onRecargar}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /nuevo servicio/i })
    );
    fireEvent.change(screen.getByLabelText(/nombre canónico/i), {
      target: { value: 'Sellante dental' }
    });
    fireEvent.change(screen.getByLabelText(/especialidad \/ categoría/i), {
      target: { value: 'Prevención' }
    });
    fireEvent.change(screen.getByLabelText(/precio de referencia/i), {
      target: { value: '95.50' }
    });
    fireEvent.click(
      screen.getByRole('button', { name: /guardar servicio/i })
    );

    await waitFor(() => {
      expect(api.crearServicioCatalogo).toHaveBeenCalledWith({
        nombre: 'Sellante dental',
        categoria: 'Prevención',
        precio: 95.5,
        activo: true
      });
    });
    expect(onRecargar).toHaveBeenCalledOnce();
  });

  it('filtra por especialidad sin depender de tildes', () => {
    render(
      <CatalogoServiciosPage servicios={servicios} onRecargar={vi.fn()} />
    );

    fireEvent.change(
      screen.getByPlaceholderText(/buscar por nombre/i),
      { target: { value: 'diagnostico' } }
    );

    expect(screen.getByText('Consulta de evaluación')).toBeInTheDocument();
  });

  it('mantiene visible la acción para editar un servicio', () => {
    render(
      <CatalogoServiciosPage servicios={servicios} onRecargar={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /editar/i })).toHaveClass(
      'dp-catalog-edit-action'
    );
  });
});
