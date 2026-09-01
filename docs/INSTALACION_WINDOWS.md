# Instalación de DentalPro en Windows

## Base productiva

La única base oficial es:

```text
dentalpro.db
```

No se usan en producción `dentalpro_original.db`, `dentalpro_pruebas.db` ni
`dentalpro_vacia.db`.

El instalador guarda la base oficial y los documentos fuera de OneDrive y de
los archivos reemplazables del programa:

```text
C:\ProgramData\DentalPro\data\dentalpro.db
C:\ProgramData\DentalPro\data\documentos\
C:\ProgramData\DentalPro\data\respaldos\
C:\ProgramData\DentalPro\data\logs\
```

La desinstalación o una actualización de los binarios no elimina estos datos.

## Edición de práctica

El mismo instalador crea un segundo acceso directo llamado **DentalPro
Práctica**. Esta edición no usa copias de los pacientes reales. Su base fija es:

```text
C:\ProgramData\DentalPro-Practica\data\dentalpro.db
```

Al abrirla por primera vez genera datos ficticios y el acceso
`practica.admin` / `Practica2026!`. Se reconoce por su apariencia ámbar y por el
aviso permanente **Modo práctica**. El botón **Restablecer práctica** repone los
ejemplos de entrenamiento después de exigir la frase `RESTABLECER PRACTICA`.

La edición oficial y la de práctica tienen ejecutables, carpetas, sesiones,
documentos, respaldos y registros separados. No existe un selector de base y
ninguna de las dos puede reutilizar el servidor de la otra.

## Construir el paquete privado de la clínica

Detén primero cualquier backend o ejecutable anterior de DentalPro. Desde la
raíz del proyecto ejecuta:

```powershell
.\scripts\construir_windows.ps1 -IncluirDatosClinica
```

El proceso:

1. ejecuta las pruebas;
2. compila el frontend;
3. genera `DentalPro.exe` y `DentalProPractica.exe` sin consola;
4. valida y copia únicamente la base oficial y sus documentos desde
   `C:\ProgramData\DentalPro\data`;
5. crea un instalador con Inno Setup 6, si está disponible;
6. en su ausencia, crea un ZIP portátil equivalente.

El instalador queda en:

```text
dist\instalador\DentalPro_Instalador_Privado.exe
```

Si Inno Setup 6 no está instalado, el ZIP queda en:

```text
dist\paquetes-privados\
```

## Instalación en el equipo de la clínica

1. Lleva el instalador privado mediante un medio seguro.
2. Haz doble clic en `DentalPro_Instalador_Privado.exe`.
3. Acepta la confirmación de Windows.
4. Conserva marcada la opción **Abrir DentalPro**.

El instalador crea el acceso directo **DentalPro** en el escritorio. En cada
uso posterior basta con hacer doble clic: el servidor se inicia oculto y el
navegador abre la aplicación automáticamente.

También crea **DentalPro Práctica**. Ambos accesos pueden abrirse al mismo
tiempo; cada uno reutiliza solamente su propia instancia si se hace doble clic
otra vez.

Si DentalPro ya está ejecutándose, otro doble clic abre la instancia existente
en vez de iniciar un segundo servidor.

## Privacidad

El instalador generado con `-IncluirDatosClinica` contiene información privada.
No debe adjuntarse a un issue, commit, Pull Request o Release de GitHub, ni
enviarse por un canal público. El repositorio solo conserva el código del
instalador y nunca la base real.

## Actualizaciones futuras

Para una actualización sin datos ejecuta:

```powershell
.\scripts\construir_windows.ps1
```

El instalador actualizará el programa, pero la regla `onlyifdoesntexist`
impedirá que una base incluida accidentalmente reemplace
`C:\ProgramData\DentalPro\data\dentalpro.db`.
