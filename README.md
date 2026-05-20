import { targets } from '../config/targets';
import * as fs from 'fs';
import * as path from 'path';

function generateReport() {
  const rows = targets
    .map((t) => {
      const before = `screenshots/before/${t.filename}.png`;
      const after = `screenshots/after/${t.filename}.png`;
      const beforeExists = fs.existsSync(before);
      const afterExists = fs.existsSync(after);
      return `
        <section class="change">
          <h2>${t.label}</h2>
          <p class="meta">${t.url}</p>
          <div class="pair">
            <figure>
              <figcaption>Before</figcaption>
              ${beforeExists ? `<img src="${before}" />` : '<div class="missing">No baseline</div>'}
            </figure>
            <figure>
              <figcaption>After</figcaption>
              ${afterExists ? `<img src="${after}" />` : '<div class="missing">Not captured</div>'}
            </figure>
          </div>
        </section>
      `;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>UAT Comparison Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1400px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    .change { margin: 3rem 0; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; }
    .change h2 { margin-top: 0; }
    .meta { color: #666; font-size: 0.9rem; margin-top: -0.5rem; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
    figure { margin: 0; }
    figcaption { font-weight: 600; margin-bottom: 0.5rem; padding: 0.4rem 0.8rem; background: #f4f4f4; border-radius: 4px; }
    img { width: 100%; border: 1px solid #ccc; border-radius: 4px; display: block; }
    .missing { padding: 2rem; background: #fff4f4; border: 1px dashed #c66; border-radius: 4px; text-align: center; color: #c66; }
  </style>
</head>
<body>
  <h1>UAT Comparison Report</h1>
  <p>Generated ${new Date().toLocaleString()}</p>
  ${rows}
</body>
</html>`;

  fs.writeFileSync('report.html', html);
  console.log('Report written to report.html');
}

generateReport();





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
