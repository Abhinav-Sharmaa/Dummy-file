{
  "scripts": {
    "capture:before": "npx ts-node scripts/capture.ts before",
    "capture:after": "npx ts-node scripts/capture.ts after",
    "report": "npx ts-node scripts/report.ts"
  }
}


{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  }
}
