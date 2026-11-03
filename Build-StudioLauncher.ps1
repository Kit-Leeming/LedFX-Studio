$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework C# compiler is missing.' }
& $compiler /nologo /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll ('/win32icon:' + (Join-Path $projectRoot 'ledfx_assets\discord.ico')) ('/out:' + (Join-Path $projectRoot 'LedFX Studio.exe')) (Join-Path $projectRoot 'launcher\StudioLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Studio launcher build failed.' }
