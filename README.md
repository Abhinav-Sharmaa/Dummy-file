$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path ".reports" | Out-Null

@{
  startTime = $data.timestamp
  prompt    = $data.initialPrompt
  commit    = (git rev-parse HEAD 2>$null)
} | ConvertTo-Json | Out-File ".reports\.session-info.json" -Encoding UTF8


$infoFile = ".reports\.session-info.json"
if (-not (Test-Path $infoFile)) { exit 0 }

$info = Get-Content $infoFile | ConvertFrom-Json
$endTime  = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$duration = [math]::Round(($endTime - $info.startTime) / 60000)
$date     = Get-Date -Format "yyyy-MM-dd_HH-mm"
$report   = ".reports\session-$date.md"

@"
# Client Session Report

**Date:** $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Duration:** $duration minutes

## Task requested
$($info.prompt)

## Files changed
"@ | Out-File $report -Encoding UTF8

if ($info.commit) {
  git diff --name-status $info.commit 2>$null | Out-File -Append $report -Encoding UTF8
  "`n## Summary" | Out-File -Append $report -Encoding UTF8
  git diff --stat $info.commit 2>$null | Out-File -Append $report -Encoding UTF8
}

Write-Host "Report saved: $report"




Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
