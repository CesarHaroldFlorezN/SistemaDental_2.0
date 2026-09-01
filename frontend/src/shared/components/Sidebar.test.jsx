import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const usuario = {
  nombre: 'Administrador de práctica',
  rol: 'administrador',
  esPropietario: true
};

describe('menú de la edición Práctica', () => {
  it('muestra su base aislada y permite solicitar el restablecimiento', () => {
    const onRestablecerPractica = vi.fn();
    render(
      <Sidebar
        vistaActiva="dashboard"
        setVistaActiva={vi.fn()}
        usuarioActual={usuario}
        onCerrarSesion={vi.fn()}
        esPractica
        onRestablecerPractica={onRestablecerPractica}
      />
    );

    expect(screen.getByText('DentalPro Práctica')).toBeInTheDocument();
    expect(screen.getByText(/base ficticia aislada/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /restablecer práctica/i })
    );
    expect(onRestablecerPractica).toHaveBeenCalledOnce();
  });
});
