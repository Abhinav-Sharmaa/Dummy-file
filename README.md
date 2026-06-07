# === Client Session Reports (Copilot hook workaround) ===

function Start-Session {
  param([string]$prompt = "Manual session")
  $json = @{
    timestamp     = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    initialPrompt = $prompt
  } | ConvertTo-Json -Compress
  $json | powershell -ExecutionPolicy Bypass -File C:\Users\F9LSIN1\.copilot\scripts\start-report.ps1
  Write-Host "Session started: $prompt" -ForegroundColor Green
  Write-Host "Snapshot saved. Run End-Session when done." -ForegroundColor DarkGray
}

function End-Session {
  powershell -ExecutionPolicy Bypass -File C:\Users\F9LSIN1\.copilot\scripts\end-report.ps1
  Write-Host "Session ended. Check .reports\ for your report." -ForegroundColor Green
}

function Show-Sessions {
  if (Test-Path .reports) {
    Get-ChildItem .reports -Filter "session-*.md" | Sort-Object LastWriteTime -Descending | Select-Object Name, LastWriteTime
  } else {
    Write-Host "No reports in this folder yet." -ForegroundColor Yellow
  }
}


# Move into your client project
cd "C:\Users\F9LSIN1\OneDrive - Fiserv Corp\Desktop\Daily changes\Today Changes\4284"

# Start a session
Start-Session "Fixing the rates page for client 4284"

# (Now do your work — edit files, etc. Use Copilot Chat freely, even if hooks don't fire)

# When done
End-Session

# View all reports in this project
Show-Sessions



Set-Alias -Name ss Start-Session
Set-Alias -Name es End-Session





