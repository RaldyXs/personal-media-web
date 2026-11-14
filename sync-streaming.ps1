[CmdletBinding()]
param (
    [switch]$ForceRestart
)

$Host.UI.RawUI.WindowTitle = "Sincronizador Anime Stream con GitHub"
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "     SINCRONIZANDO SERVIDOR ANIME CON GITHUB PAGES               " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Asegurar contenedor web activo
Write-Host "[1/4] Verificando contenedor web en servidor Linux..." -ForegroundColor Yellow
ssh joseph@192.168.16.19 "docker start anime_web >/dev/null 2>&1"

# 2. Consultar o reiniciar túnel
Write-Host "[2/4] Verificando túnel activo de Cloudflare..." -ForegroundColor Yellow
$arg = if ($ForceRestart) { "restart" } else { "" }
$output = ssh joseph@192.168.16.19 "/home/joseph/scripts/ver-tunel.sh $arg"
$match = [regex]::Match($output, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

if (-not $match.Success) {
    Write-Host "[!] No se detectó túnel activo. Forzando reinicio..." -ForegroundColor Red
    $output = ssh joseph@192.168.16.19 "/home/joseph/scripts/ver-tunel.sh restart"
    $match = [regex]::Match($output, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
}

if (-not $match.Success) {
    Write-Host "[ERROR] No se pudo obtener la URL de Cloudflare. Revisa la conexión del servidor." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

$newTunnelUrl = $match.Value
Write-Host "      URL activa detectada: $newTunnelUrl" -ForegroundColor Green

# 3. Comparar con app.config.js
Write-Host "[3/4] Comprobando configuración local..." -ForegroundColor Yellow
$configPath = "C:\Proyectos\personal-media-web\src\config\app.config.js"
$content = Get-Content $configPath -Raw

$currentMatch = [regex]::Match($content, "defaultBaseUrl:\s*'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)'")
$currentUrl = if ($currentMatch.Success) { $currentMatch.Groups[1].Value } else { "" }

if ($currentUrl -eq $newTunnelUrl) {
    Write-Host "      La configuración de GitHub ya está sincronizada con el túnel actual." -ForegroundColor Green
} else {
    Write-Host "      Actualizando URL en GitHub ($currentUrl -> $newTunnelUrl)..." -ForegroundColor Magenta
    
    $epoch = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    
    # Reemplazar URL
    $newContent = [regex]::Replace($content, "defaultBaseUrl:\s*'https://[a-zA-Z0-9-]+\.trycloudflare\.com'", "defaultBaseUrl: '$newTunnelUrl'")
    [System.IO.File]::WriteAllText($configPath, $newContent, (New-Object System.Text.UTF8Encoding($false)))
    
    # Actualizar cache-buster en index.html y app.js
    $indexPath = "C:\Proyectos\personal-media-web\index.html"
    $appJsPath = "C:\Proyectos\personal-media-web\src\app.js"
    
    $indexContent = Get-Content $indexPath -Raw
    $newIndex = [regex]::Replace($indexContent, '(\?v=)[0-9a-zA-Z._-]+', "`${1}$epoch")
    [System.IO.File]::WriteAllText($indexPath, $newIndex, (New-Object System.Text.UTF8Encoding($false)))
    
    $appContent = Get-Content $appJsPath -Raw
    $newApp = [regex]::Replace($appContent, '(\?v=)[0-9a-zA-Z._-]+', "`${1}$epoch")
    [System.IO.File]::WriteAllText($appJsPath, $newApp, (New-Object System.Text.UTF8Encoding($false)))
    
    # Git commit y push
    Push-Location "C:\Proyectos\personal-media-web"
    git add src/config/app.config.js index.html src/app.js
    git commit -m "fix(tunnel): actualizar endpoint activo a $newTunnelUrl"
    git push origin main
    Pop-Location
    
    # Sincronizar al servidor Linux también
    scp -r "$configPath" "$indexPath" "$appJsPath" "joseph@192.168.16.19:/home/joseph/anime-stream/web/"
    Write-Host "      Repositorio de GitHub y servidor Linux actualizados." -ForegroundColor Green
}

# 4. Resultado final
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " ¡TODO LISTO! TU ENLACE PERMANENTE ES:" -ForegroundColor Green
Write-Host ""
Write-Host " 👉 https://raldyxs.github.io/personal-media-web/" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host " Puedes abrirlo en cualquier celular o PC sin añadir parámetros." -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
