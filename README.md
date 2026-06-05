try { Get-Content "C:\Users\F9LSIN1\.copilot\hooks\Session report.json" -Raw | ConvertFrom-Json | Out-Null; "JSON is VALID" } catch { "JSON is BROKEN: $_" }


Get-Content C:\Users\F9LSIN1\.copilot\scripts\start-report.ps1 | Select-Object -First 2



echo '{"timestamp":1717593600000,"initialPrompt":"test","cwd":"C:\\test"}' | powershell -ExecutionPolicy Bypass -File C:\Users\F9LSIN1\.copilot\scripts\start-report.ps1
Get-Content C:\Users\F9LSIN1\hook-debug.log


