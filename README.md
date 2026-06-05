{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "command": "powershell -ExecutionPolicy Bypass -File C:\\Users\\F9LSIN1\\.copilot\\scripts\\start-report.ps1"
      }
    ],
    "sessionEnd": [
      {
        "type": "command",
        "command": "powershell -ExecutionPolicy Bypass -File C:\\Users\\F9LSIN1\\.copilot\\scripts\\end-report.ps1"
      }
    ]
  }
}



Get-ChildItem C:\Users\F9LSIN1\.copilot\scripts



echo '{"timestamp":1717593600000,"initialPrompt":"manual test"}' | powershell -ExecutionPolicy Bypass -File C:\Users\F9LSIN1\.copilot\scripts\start-report.ps1


Get-ChildItem .reports

