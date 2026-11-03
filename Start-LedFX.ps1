$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$executable = Join-Path $projectRoot 'dist\LedFx\LedFx.exe'
$configDirectory = Join-Path $projectRoot 'portable-data'
$configFile = Join-Path $configDirectory 'config.json'

if (-not (Test-Path -LiteralPath $executable)) {
    Write-Error "Portable LedFX build is missing: $executable"
    exit 1
}

$port = 8888
if (Test-Path -LiteralPath $configFile) {
    try {
        $savedConfig = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
        if ($savedConfig.port -and [int]$savedConfig.port -ge 1 -and [int]$savedConfig.port -le 65535) {
            $port = [int]$savedConfig.port
        }
    }
    catch {
        Write-Error "Cannot read LedFX port from $configFile`: $_"
        exit 1
    }
}

$mutex = [Threading.Mutex]::new($false, 'Local\LedFX_Portable_Starter')
if (-not $mutex.WaitOne([TimeSpan]::FromSeconds(15))) {
    Write-Error 'Another portable LedFX launch is still starting.'
    exit 1
}

try {
    $expectedPath = [IO.Path]::GetFullPath($executable)
    $running = @(Get-Process -Name LedFx -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -eq $expectedPath } catch { $false }
    })
    $url = "http://127.0.0.1:$port"

    if ($running.Count -gt 0) {
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            try {
                $response = Invoke-WebRequest -Uri "$url/api/info" -TimeoutSec 2 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    try {
                        Start-Process $url -ErrorAction Stop
                        Write-Output "LedFX is already running. Opened $url"
                    }
                    catch {
                        Write-Output "LedFX is already running at $url. Open that address in your browser."
                    }
                    exit 0
                }
            }
            catch { }
            Start-Sleep -Milliseconds 250
        }
        Write-Error "Portable LedFX is running, but its interface is not responding at $url. Check portable-data\ledfx.log."
        exit 1
    }

    $socket = [Net.Sockets.TcpClient]::new()
    try {
        $connected = $socket.ConnectAsync('127.0.0.1', $port).Wait(500) -and $socket.Connected
    }
    catch {
        $connected = $false
    }
    finally {
        $socket.Dispose()
    }
    if ($connected) {
        Write-Error "Port $port is already in use by another application. Close it or change the port in portable-data\config.json."
        exit 1
    }

    New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
    $arguments = @('-c', ('"{0}"' -f $configDirectory), '--open-ui') + $args
    $process = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    Write-Output "Started portable LedFX (process $($process.Id))."
}
finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
