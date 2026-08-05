# DentalPro 2.0

Sistema local para administrar pacientes, citas, tratamientos, pagos y documentos de una clínica dental.

## Funcionalidades

- Registro y búsqueda de pacientes.
- Agenda mensual, semanal y diaria.
- Control de recepción y estados de las citas.
- Registro de tratamientos y sesiones.
- Pagos al contado, anticipos y cuotas.
- Estado de cuenta del paciente.
- Carga de documentos clínicos.
- Importación y exportación de pacientes mediante CSV.
- Tema claro y oscuro.

## Tecnologías

### Backend

- Python 3.11 o superior.
- FastAPI.
- SQLAlchemy.
- SQLite.
- Uvicorn.

### Frontend

- React.
- Vite.
- Tailwind CSS.
- React Big Calendar.
- SweetAlert2.

Vite requiere Node.js `20.19.0` o superior, o Node.js `22.12.0` o superior.

## Estructura principal

```text
backend/
  app/
    main.py
    config.py
    database.py
    models/
    routers/
    schemas/
    services/

frontend/
  src/
    features/
    services/
    shared/

tests/
docs/
scripts/
data/
README.md
pyproject.toml
```

## Instalación del backend en Windows

Desde la carpeta raíz del proyecto:

```powershell
python -m venv .venv
```

Instalar las dependencias:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

## Ejecutar el backend

Desde la carpeta raíz:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

El backend estará disponible en:

- API: http://127.0.0.1:8000
- Documentación: http://127.0.0.1:8000/docs
- Comprobación de salud: http://127.0.0.1:8000/api/salud

La terminal del backend debe permanecer abierta.

## Instalación del frontend

En una segunda terminal:

```powershell
cd frontend
npm ci
```

## Ejecutar el frontend

```powershell
npm run dev
```

Abrir en el navegador:

http://127.0.0.1:5173

Las terminales del backend y frontend deben permanecer abiertas mientras se utiliza el sistema.

## Pruebas del backend

Desde la carpeta raíz:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Verificaciones del frontend

Desde `frontend/`:

```powershell
npm run lint
npm run build
```

La advertencia relacionada con archivos mayores de 500 kB no impide la compilación.

## Base de datos y documentos

Los datos locales se almacenan en:

```text
data/dentalpro.db
```

Los documentos de pacientes se almacenan en:

```text
data/documentos/
```

Estos archivos no se suben a GitHub para proteger la información privada de los pacientes.

## Generar el ejecutable

Primero se debe compilar el frontend:

```powershell
cd frontend
npm ci
npm run build
cd ..
```

Después se genera el programa:

```powershell
.\.venv\Scripts\python.exe -m PyInstaller SistemaDental.spec
```

El resultado se encontrará dentro de:

```text
dist/SistemaDental/
```

## Estado de la reorganización

La nueva estructura está creada, pero la migración del backend continúa progresivamente. Actualmente `backend/app/main.py` reutiliza temporalmente la aplicación existente en el `main.py` principal.

No se debe eliminar el `main.py` principal hasta terminar de migrar y probar todas las rutas.