New-Item -ItemType Directory -Force -Path .github\hooks | Out-Null
Copy-Item "C:\Users\F9LSIN1\.copilot\hooks\Session report.json" ".github\hooks\hooks.json"



Get-Content .github\hooks\hooks.json


Get-Content C:\Users\F9LSIN1\hook-debug.log


