"Hook fired at $(Get-Date) in cwd: $((Get-Location).Path)" | Out-File "C:\Users\F9LSIN1\hook-debug.log" -Append


"END hook fired at $(Get-Date) in cwd: $((Get-Location).Path)" | Out-File "C:\Users\F9LSIN1\hook-debug.log" -Append


Get-Content C:\Users\F9LSIN1\hook-debug.log


Get-ChildItem "<that cwd path>\.reports"
