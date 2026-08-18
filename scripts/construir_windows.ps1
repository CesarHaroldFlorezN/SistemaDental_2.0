param(
    [switch]$IncluirDatosClinica,
    [switch]$OmitirPruebas,
    [string]$RutaInnoSetup = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$raiz = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$python = Join-Path $raiz ".venv\Scripts\python.exe"
$frontend = Join-Path $raiz "frontend"
$dist = Join-Path $raiz "dist"
$programa = Join-Path $dist "DentalPro"
$payload = Join-Path $dist "payload-clinica"
$salidaPrivada = Join-Path $dist "paquetes-privados"

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw "No se encontró .venv\Scripts\python.exe. Activa o crea el entorno virtual."
}

Push-Location $raiz
try {
    & $python -m pip install -e ".[dev]"
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudieron instalar las dependencias de compilación."
    }

    Push-Location $frontend
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci no terminó correctamente."
        }

        if (-not $OmitirPruebas) {
            npm test
            if ($LASTEXITCODE -ne 0) {
                throw "Las pruebas del frontend fallaron."
            }

            npm run lint
            if ($LASTEXITCODE -ne 0) {
                throw "La validación del frontend falló."
            }
        }

        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo compilar el frontend."
        }
    }
    finally {
        Pop-Location
    }

    if (-not $OmitirPruebas) {
        & $python -m pytest
        if ($LASTEXITCODE -ne 0) {
            throw "Las pruebas del backend fallaron."
        }
    }

    & $python -m PyInstaller --clean --noconfirm SistemaDental.spec
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $programa)) {
        throw "PyInstaller no generó dist\DentalPro."
    }

    if ($IncluirDatosClinica) {
        & $python scripts\preparar_paquete_clinica.py `
            --origen data `
            --destino $payload
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo preparar la copia privada de dentalpro.db."
        }
    }
    elseif (Test-Path -LiteralPath $payload) {
        # Evita que una compilación normal reutilice datos privados preparados
        # por una ejecución anterior.
        Remove-Item -LiteralPath $payload -Recurse -Force
    }

    if (-not $RutaInnoSetup) {
        $candidatosInno = @(
            "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
            "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
        )
        $RutaInnoSetup = @(
            $candidatosInno |
            Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }
        ) | Select-Object -First 1
    }

    if ($RutaInnoSetup -and (Test-Path -LiteralPath $RutaInnoSetup -PathType Leaf)) {
        & $RutaInnoSetup (Join-Path $raiz "installer\DentalPro.iss")
        if ($LASTEXITCODE -ne 0) {
            throw "Inno Setup no pudo crear el instalador."
        }

        Write-Host ""
        Write-Host "Instalador generado en dist\instalador\."
        if ($IncluirDatosClinica) {
            Write-Warning "El instalador contiene dentalpro.db. Es privado: no lo subas a GitHub."
        }
    }
    else {
        New-Item -ItemType Directory -Path $salidaPrivada -Force | Out-Null
        $marca = Get-Date -Format "yyyyMMdd_HHmmss"
        $portable = Join-Path $dist "DentalPro_Portable_$marca"
        Copy-Item -LiteralPath $programa -Destination $portable -Recurse

        if ($IncluirDatosClinica) {
            Copy-Item -LiteralPath $payload -Destination (Join-Path $portable "data") -Recurse
        }

        $zip = Join-Path $salidaPrivada "DentalPro_Portable_$marca.zip"
        Compress-Archive -Path (Join-Path $portable "*") -DestinationPath $zip
        Write-Host ""
        Write-Host "Inno Setup no está instalado. Se generó la versión portátil:"
        Write-Host $zip
        Write-Host "Al abrir DentalPro.exe no aparecerá la consola y la página se abrirá sola."
        if ($IncluirDatosClinica) {
            Write-Warning "Este ZIP contiene dentalpro.db. Es privado: no lo subas a GitHub."
        }
    }
}
finally {
    Pop-Location
}
