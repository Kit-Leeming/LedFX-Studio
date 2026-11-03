$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$uvExe = Join-Path $projectRoot '.tools\uv.exe'
$nodeBin = Join-Path $projectRoot '.tools\nodejs'
$pythonExe = Join-Path $projectRoot '.python\cpython-3.12-windows-x86_64-none\python.exe'
$venvPath = Join-Path $projectRoot '.venv'

if (-not (Test-Path -LiteralPath $uvExe)) { throw "Missing $uvExe" }
if (-not (Test-Path -LiteralPath (Join-Path $nodeBin 'npm.cmd'))) { throw "Missing local Node/npm" }
if (-not (Test-Path -LiteralPath $pythonExe)) { throw "Missing local Python 3.12" }

$env:UV_CACHE_DIR = Join-Path $projectRoot '.uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $projectRoot '.python'
$env:Path = "$nodeBin;$env:Path"

# A venv contains an absolute Python home. Recreate it after a drive-letter move.
$venvConfig = Join-Path $venvPath 'pyvenv.cfg'
if (Test-Path -LiteralPath $venvConfig) {
    $homeLine = Get-Content -LiteralPath $venvConfig | Where-Object { $_ -like 'home = *' } | Select-Object -First 1
    if ($homeLine -and $homeLine.Substring(7).Trim() -ne (Split-Path -Parent $pythonExe)) {
        $resolvedRoot = [IO.Path]::GetFullPath($projectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
        $resolvedVenv = [IO.Path]::GetFullPath($venvPath)
        if (-not $resolvedVenv.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Virtual environment path is outside this project'
        }
        Remove-Item -LiteralPath $resolvedVenv -Recurse -Force
    }
}

Push-Location $projectRoot
try {
    & $uvExe sync --frozen --offline --group dev --group build --python $pythonExe
    if ($LASTEXITCODE -ne 0) { throw 'Offline Python dependency restore failed' }

    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        if (-not (Test-Path -LiteralPath 'node_modules\.bin\craco.cmd')) {
            & (Join-Path $nodeBin 'npm.cmd') install --ignore-scripts --legacy-peer-deps --no-audit --no-fund --offline --cache (Join-Path $projectRoot '.npm-cache')
            if ($LASTEXITCODE -ne 0) { throw 'Offline frontend dependency restore failed' }
        }
        & (Join-Path $nodeBin 'npm.cmd') run build:win32
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    }
    finally { Pop-Location }

    Copy-Item -Path (Join-Path $projectRoot 'frontend\build\*') -Destination (Join-Path $projectRoot 'ledfx_frontend') -Recurse -Force
    $manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'ledfx_frontend\asset-manifest.json') -Raw | ConvertFrom-Json
    $currentMain = Split-Path -Leaf $manifest.files.'main.js'
    $bundledJs = Join-Path $projectRoot 'ledfx_frontend\static\js'
    Get-ChildItem -LiteralPath $bundledJs -File |
        Where-Object { $_.Name -match '^main\.[^.]+\.js(\.LICENSE\.txt)?$' -and $_.Name -notin @($currentMain, "$currentMain.LICENSE.txt") } |
        Remove-Item -Force
    $officialFrontendConfig = '{"updateUrl":"https://api.github.com/repos/LedFx/LedFx/releases/latest","releaseUrl":"https://github.com/LedFx/LedFx/releases/latest"}'
    Set-Content -LiteralPath (Join-Path $projectRoot 'ledfx_frontend\frontend_config.json') -Value $officialFrontendConfig -NoNewline
    & (Join-Path $projectRoot '.venv\Scripts\python.exe') -m PyInstaller --noconfirm windows-binary.spec
    if ($LASTEXITCODE -ne 0) { throw 'Windows application build failed' }
    & (Join-Path $projectRoot 'Build-StudioLauncher.ps1')
}
finally { Pop-Location }
