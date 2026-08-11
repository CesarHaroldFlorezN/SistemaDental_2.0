export const TEMAS_VISUALES = [
  {
    id: 'azul-clinico',
    codigo: 'A',
    nombre: 'Azul Clínico',
    descripcion: 'Serenidad y confianza',
    primario: '#0284c7',
    secundario: '#e0f2fe',
    acento: '#10b981'
  },
  {
    id: 'menta-dental',
    codigo: 'B',
    nombre: 'Menta & Diente',
    descripcion: 'Salud y modernidad',
    primario: '#0d9488',
    secundario: '#ccfbf1',
    acento: '#2563eb'
  },
  {
    id: 'gris-calmado',
    codigo: 'C',
    nombre: 'Gris Calmado',
    descripcion: 'Sofisticación',
    primario: '#1e293b',
    secundario: '#e2e8f0',
    acento: '#d97706'
  },
  {
    id: 'cian-digital',
    codigo: 'D',
    nombre: 'Cian Digital',
    descripcion: 'Tecnología dental',
    primario: '#06b6d4',
    secundario: '#475569',
    acento: '#f97316'
  }
];

export const normalizarTemaGuardado = (tema) => {
  if (TEMAS_VISUALES.some((opcion) => opcion.id === tema)) {
    return tema;
  }

  // Las versiones anteriores guardaban solamente "light" o "dark".
  return 'azul-clinico';
};
