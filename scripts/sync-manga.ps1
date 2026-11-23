# Sync Hunter x Hunter PDFs from local download folder to Linux server
$localDir = "C:\Users\jfper\Downloads\Hunter x Hunter (PDF)"
$remoteHost = "joseph@192.168.16.19"
$remoteDir = "/home/joseph/anime-stream/videos/mangas/hunter-x-hunter"

Write-Host "Fetching existing files on server..." -ForegroundColor Cyan
$serverFiles = ssh -o StrictHostKeyChecking=no $remoteHost "ls -1 '$remoteDir'"
$serverSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($line in $serverFiles) {
    if (-not [string]::IsNullOrWhiteSpace($line)) {
        [void]$serverSet.Add($line.Trim())
    }
}

$localFiles = Get-ChildItem -Path $localDir -Filter "*.pdf"
$pending = @()
foreach ($file in $localFiles) {
    if (-not $serverSet.Contains($file.Name)) {
        $pending += $file
    }
}

Write-Host "Total local files: $($localFiles.Count)" -ForegroundColor Green
Write-Host "Already on server: $($serverSet.Count)" -ForegroundColor Green
Write-Host "Pending upload: $($pending.Count)" -ForegroundColor Yellow

if ($pending.Count -eq 0) {
    Write-Host "All files are synchronized!" -ForegroundColor Green
    exit 0
}

$counter = 0
foreach ($file in $pending) {
    $counter++
    Write-Host "[$counter/$($pending.Count)] Uploading $($file.Name)..."
    scp -o StrictHostKeyChecking=no -q $file.FullName "${remoteHost}:${remoteDir}/"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to upload $($file.Name)"
    }
}

Write-Host "Sync batch complete!" -ForegroundColor Green
