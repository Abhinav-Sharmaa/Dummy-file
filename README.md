powershell -Command "New-Item -ItemType Directory -Force -Path .reports | Out-Null; (Get-Date).Ticks | Out-File .reports\.session-start; git rev-parse HEAD 2>$null | Out-File .reports\.session-commit"


powershell -Command "$start=[long](Get-Content .reports\.session-start); $dur=[math]::Round(([DateTime]::Now.Ticks - $start)/600000000); $commit=Get-Content .reports\.session-commit -ErrorAction SilentlyContinue; $date=Get-Date -Format 'yyyy-MM-dd_HH-mm'; $report=\".reports\session-$date.md\"; \"# Client Session Report`n**Date:** $(Get-Date)`n**Duration:** $dur minutes`n`n## Files changed`n\" | Out-File $report; git diff --name-status $commit 2>$null | Out-File -Append $report; Write-Host \"Report saved: $report\""



powershell -ExecutionPolicy Bypass -File C:\Users\F9LSIN1\.copilot\scripts\start-report.ps1
