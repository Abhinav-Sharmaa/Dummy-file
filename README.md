$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path ".reports" | Out-Null

@{
  startTime = $data.timestamp
  prompt    = $data.initialPrompt
} | ConvertTo-Json | Out-File ".reports\.session-info.json" -Encoding UTF8


$infoFile = ".reports\.session-info.json"
if (-not (Test-Path $infoFile)) { exit 0 }

$info     = Get-Content $infoFile | ConvertFrom-Json
$endTime  = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$duration = [math]::Round(($endTime - $info.startTime) / 60000)
$date     = Get-Date -Format "yyyy-MM-dd_HH-mm"
$report   = ".reports\session-$date.md"
$startDate = [DateTimeOffset]::FromUnixTimeMilliseconds($info.startTime).LocalDateTime

@"
# Client Session Report

**Date:** $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Duration:** $duration minutes

## Task requested
$($info.prompt)

## Files changed
"@ | Out-File $report -Encoding UTF8

$changed = Get-ChildItem -Recurse -File |
  Where-Object { $_.LastWriteTime -ge $startDate -and $_.FullName -notmatch '\\.reports\\' }

if ($changed) {
  foreach ($f in $changed) {
    $rel = Resolve-Path -Relative $f.FullName
    "- $rel  _(modified $($f.LastWriteTime.ToString('HH:mm:ss')), $($f.Length) bytes)_" |
      Out-File -Append $report -Encoding UTF8
  }
} else {
  "_No files modified during session._" | Out-File -Append $report -Encoding UTF8
}

Write-Host "Report saved: $report"



echo '{"timestamp":1717593600000,"initialPrompt":"manual test"}' | powershell -ExecutionPolicy Bypass -File C:\Users\F9LSIN1\.copilot\scripts\start-report.ps1


powershell -ExecutionPolicy Bypass -File C:\Users\F9LSIN1\.copilot\scripts\end-report.ps1



