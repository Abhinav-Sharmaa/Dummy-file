$raw = [Console]::In.ReadToEnd()
$data = $raw | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path ".reports" | Out-Null
New-Item -ItemType Directory -Force -Path ".reports\.snapshot-files" | Out-Null

# Copy current files into snapshot
Get-ChildItem -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\.reports\\' } |
  ForEach-Object {
    $rel = Resolve-Path -Relative $_.FullName
    $dest = Join-Path ".reports\.snapshot-files" $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item $_.FullName $dest -Force
  }

# Use system clock — reliable across all Copilot versions
@{
  startTime = (Get-Date).ToString("o")   # ISO 8601 format
  prompt    = $data.initialPrompt
} | ConvertTo-Json | Out-File ".reports\.session-info.json" -Encoding UTF8


$startDate = [DateTime]::Parse($info.startTime)
$endDate   = Get-Date
$duration  = [math]::Round(($endDate - $startDate).TotalMinutes, 1)


$infoFile = ".reports\.session-info.json"
if (-not (Test-Path $infoFile)) { exit 0 }

$info       = Get-Content $infoFile -Raw | ConvertFrom-Json
$endTime    = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$duration   = [math]::Round(($endTime - $info.startTime) / 60000)
$date       = Get-Date -Format "yyyy-MM-dd_HH-mm"
$report     = ".reports\session-$date.md"
$snapshotDir = ".reports\.snapshot-files"

# Index files
$current = @{}
Get-ChildItem -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\.reports\\' } |
  ForEach-Object { $current[(Resolve-Path -Relative $_.FullName)] = $_.FullName }

$old = @{}
if (Test-Path $snapshotDir) {
  Get-ChildItem -Recurse -File -Path $snapshotDir | ForEach-Object {
    $rel = $_.FullName.Substring((Resolve-Path $snapshotDir).Path.Length + 1)
    $old[".\$rel"] = $_.FullName
  }
}

$added = @(); $modified = @(); $deleted = @()
foreach ($p in $current.Keys) {
  if (-not $old.ContainsKey($p)) { $added += $p }
  elseif ((Get-FileHash $current[$p]).Hash -ne (Get-FileHash $old[$p]).Hash) { $modified += $p }
}
foreach ($p in $old.Keys) { if (-not $current.ContainsKey($p)) { $deleted += $p } }

# Write report header
@"
# Client Session Report

**Date:** $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Duration:** $duration minutes

## Task requested
$($info.prompt)

## Summary
- Added: $($added.Count)
- Modified: $($modified.Count)
- Deleted: $($deleted.Count)

"@ | Out-File $report -Encoding UTF8

# Detailed diffs
if ($added) {
  "## Added files" | Out-File -Append $report -Encoding UTF8
  foreach ($p in $added) {
    "### $p" | Out-File -Append $report -Encoding UTF8
    '```' | Out-File -Append $report -Encoding UTF8
    Get-Content $current[$p] | Out-File -Append $report -Encoding UTF8
    '```' | Out-File -Append $report -Encoding UTF8
  }
}

if ($modified) {
  "## Modified files" | Out-File -Append $report -Encoding UTF8
  foreach ($p in $modified) {
    "### $p" | Out-File -Append $report -Encoding UTF8
    $diff = Compare-Object (Get-Content $old[$p]) (Get-Content $current[$p])
    '```diff' | Out-File -Append $report -Encoding UTF8
    foreach ($d in $diff) {
      $prefix = if ($d.SideIndicator -eq '=>') { '+ ' } else { '- ' }
      "$prefix$($d.InputObject)" | Out-File -Append $report -Encoding UTF8
    }
    '```' | Out-File -Append $report -Encoding UTF8
  }
}

if ($deleted) {
  "## Deleted files" | Out-File -Append $report -Encoding UTF8
  $deleted | ForEach-Object { "- $_" } | Out-File -Append $report -Encoding UTF8
}

# Cleanup snapshot to save disk space
Remove-Item -Recurse -Force $snapshotDir -ErrorAction SilentlyContinue

Write-Host "Report saved: $report"

