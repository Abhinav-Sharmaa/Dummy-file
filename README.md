{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "powershell -ExecutionPolicy Bypass -File C:\\Users\\F9LSIN1\\.copilot\\scripts\\start-report.ps1"
      }
    ],
    "SessionEnd": [
      {
        "type": "command",
        "command": "powershell -ExecutionPolicy Bypass -File C:\\Users\\F9LSIN1\\.copilot\\scripts\\end-report.ps1"
      }
    ]
  }
}
