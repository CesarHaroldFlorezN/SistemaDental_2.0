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

En Windows, la base aislada de pruebas se almacena en:

```text
%LOCALAPPDATA%\DentalPro\pruebas\dentalpro-pruebas.db
```

No deben mantenerse activas las variables antiguas `DENTALPRO_DATA_DIR` o
`DENTALPRO_DB_PATH` durante el uso normal. El sistema detecta automáticamente
en cuál de las dos bases existe una cuenta activa y abre únicamente ese
entorno.

El menú **Usuarios** está disponible para cuentas administradoras:

- el Administrador oficial puede listar y crear cuentas en ambas bases;
- el Administrador de pruebas solo puede gestionar la base de pruebas;
- `cesar.admin` y `adminpruebas` son cuentas propietarias protegidas;
- solo una cuenta propietaria puede crear o modificar otros administradores;
- los administradores delegados pueden gestionar cuentas de Odontología y
  Recepción, pero no crear otros administradores;
- crear, activar, desactivar o restablecer una clave exige confirmar la
  contraseña del Administrador;
- una misma cuenta no puede estar activa simultáneamente en ambas bases;
- para cambiar una cuenta de base, primero se desactiva en el origen y después
  se crea en el destino con una nueva contraseña temporal.

Los documentos de pacientes se almacenan en:

```text
data/documentos/
```

Estos archivos no se suben a GitHub para proteger la información privada de los pacientes.

## Reemplazar la base desde un JSON oficial

Los archivos `DentalPro_*.json` contienen datos privados y tampoco deben subirse a
GitHub. La sustitución se realiza localmente y siempre con el backend detenido.

Primero valida el archivo sin modificar la base activa:

```powershell
.\.venv\Scripts\python.exe -m backend.app.gestion_bd validar-json-oficial `
  "$env:USERPROFILE\Downloads\DentalPro_2026-08-13.json"
```

Si la validación informa códigos de ficha duplicados, se puede generar una
identificación única y dejar el ajuste registrado:

```powershell
.\.venv\Scripts\python.exe -m backend.app.gestion_bd validar-json-oficial `
  "$env:USERPROFILE\Downloads\DentalPro_2026-08-13.json" `
  --resolver-duplicados-ficha
```

Después de revisar las advertencias, el reemplazo completo se ejecuta así:

```powershell
.\.venv\Scripts\python.exe -m backend.app.gestion_bd importar-json-oficial `
  "$env:USERPROFILE\Downloads\DentalPro_2026-08-13.json" `
  --resolver-duplicados-ficha `
  --aceptar-advertencias `
  --confirmar REEMPLAZAR `
  --servidor-detenido
```

El proceso:

- valida estructura, identificadores, referencias y montos antes de escribir;
- prepara y audita una base SQLite temporal;
- crea un respaldo automático de `data/dentalpro.db`;
- reemplaza pacientes, citas, pagos, planes y planes de pago;
- conserva las cuentas de usuario y el catálogo de servicios/precios, pero
  revoca las sesiones abiertas;
- registra el origen, SHA-256, conteos, advertencias y ajustes de la importación.

Los archivos de `data/documentos/` no se eliminan automáticamente. Dejan de estar
vinculados a la base nueva, pero se conservan para evitar una pérdida irreversible.

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

## Arquitectura del frontend

`frontend/src/App.jsx` funciona como coordinador de sesión, navegación y estado
de interfaz. La implementación se reparte por responsabilidad:

- `frontend/src/app/hooks/useDentalProData.js`: carga y limpieza de los datos de
  la sesión activa;
- `frontend/src/app/actions/`: operaciones de pacientes, citas, cierres
  clínico-financieros, planes de pago y planes de tratamiento;
- `frontend/src/app/selectores.js`: búsquedas, enriquecimiento y cálculos
  derivados sin efectos secundarios;
- `frontend/src/app/components/AppModals.jsx`: composición central de modales;
- `frontend/src/features/`: pantallas y componentes visuales de cada módulo;
- `frontend/src/shared/utils/`: funciones comunes de fecha, texto y moneda.
- `frontend/src/app/rutas.js`: rutas navegables, enlaces directos y permisos por
  módulo;
- `frontend/src/features/catalogo/`: administración de tratamientos y precios.

Esta separación permite modificar una pantalla o flujo concreto sin mezclarlo
con la autenticación ni con los demás módulos.

## Catálogo de tratamientos y precios

Cada base (oficial y pruebas) tiene su propio catálogo en
`serviciosCatalogo`. Los servicios guardan un identificador estable además del
nombre mostrado, por lo que variantes como `Ortodoncia - colocacion` y
`Ortodoncia — colocación` dejan de crear grupos distintos en reportes futuros.

El Administrador puede abrir **Tratamientos y precios** para crear, editar,
activar o desactivar servicios. Desactivar no elimina el historial. El precio
del catálogo es una referencia y puede ajustarse en una atención concreta sin
alterar registros anteriores.

La migración 8 crea y carga este catálogo automáticamente al iniciar el sistema.
Antes de aplicar una migración pendiente, DentalPro conserva el respaldo SQLite
previsto por el sistema.

## Navegación y enlaces directos

La interfaz usa React Router y conserva una URL por sección:

- `/pacientes`
- `/agenda`
- `/planes-tratamiento`
- `/finanzas`
- `/planes-pago`
- `/catalogo-servicios`
- `/usuarios`

Las fichas se pueden abrir directamente con `/pacientes/{id}`. Los botones
Atrás y Adelante del navegador mantienen la navegación y los permisos de cada
rol siguen aplicándose antes de mostrar una sección.

## Pruebas del frontend

Vitest y Testing Library verifican utilidades, rutas y comportamientos de
pantalla. Para ejecutar todas las pruebas del frontend:

```powershell
cd frontend
npm test
```

El flujo automático de GitHub ejecuta pruebas, lint y compilación del frontend.

## Agenda, sesiones vinculadas e ingresos por período

El formulario de atención incorpora una agenda compacta de solo lectura con
vistas mensual, semanal y diaria. Permite revisar la ocupación mientras se
elige la fecha y conserva la edición de horarios exclusivamente en la agenda
principal.

Los planes de tratamiento existentes pueden ampliarse. Cuando tienen un plan
de pagos vinculado, cada sesión nueva genera una cuota nueva asociada a esa
sesión. Las cuotas pagadas son inmutables y el saldo restante se distribuye
únicamente entre las pendientes. Reducir sesiones con cuotas vinculadas se
bloquea para proteger el historial financiero.

Finanzas conserva el resumen principal de cuatro tarjetas: Total Cobrado,
Ingresos del Mes, Financiado Activo y Por Cobrar. Desde el botón **Ver ingresos
y egresos** se abre un reporte independiente para hoy, esta semana, este mes,
este año o desde el inicio. El reporte separa pagos y adelantos recibidos de
anulaciones y devoluciones, muestra el resultado neto y detalla fecha, hora,
paciente, método y concepto.

Los campos de fecha y hora conservan el selector nativo completo de Chrome y
Edge, con el indicador aclarado sin alterar el ancho ni el alto del control. El
icono sigue siendo clicable y abre directamente el calendario o el reloj. La
recepción actualiza también el panel lateral abierto en el mismo instante en
que el paciente cambia a En espera o En atención, usando una notificación no
bloqueante.

El listado de pacientes se consulta al backend en bloques limitados y la tabla
se muestra en páginas de 25 registros. La API acepta `limit`, `offset` y `q`, y
valida la creación y edición con esquemas Pydantic tipados.

Los errores inesperados se registran de forma persistente y rotativa en
`data/logs/dentalpro.log`. Cuando corresponde, el mensaje muestra un código de
diagnóstico que permite localizar el traceback sin exponer detalles técnicos
en la interfaz.

La migración 9 convierte `citas.fecha`, `citas.hora` y `citas.horaFin` a tipos
SQLite `DATE` y `TIME`. Antes de reconstruir la tabla verifica que los datos
históricos sean válidos y el sistema mantiene hacia el frontend los formatos
`AAAA-MM-DD` y `HH:MM` para no romper compatibilidad.

La ficha del paciente muestra fecha y hora de cargos, pagos, cuotas, adelantos
y reversos cuando esa hora está disponible.
