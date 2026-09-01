import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

describe('acceso a DentalPro Práctica', () => {
  it('distingue la edición y completa credenciales ficticias', () => {
    render(<LoginPage onLogin={vi.fn()} esPractica />);

    expect(
      screen.getByText(/aprende sin tocar pacientes reales/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario/i)).toHaveValue('practica.admin');
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveValue(
      'Practica2026!'
    );
    expect(
      screen.getByRole('button', { name: /ingresar a dentalpro práctica/i })
    ).toBeInTheDocument();
  });
});
