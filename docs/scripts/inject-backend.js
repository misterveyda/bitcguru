const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');
const OUT = path.join(SRC, 'dist');
const BACKEND_BASE = process.env.BACKEND_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || '';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyAndInject(srcDir, outDir) {
  ensureDir(outDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const srcPath = path.join(srcDir, ent.name);
    const outPath = path.join(outDir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'dist') continue;
      copyAndInject(srcPath, outPath);
    } else {
      if (ent.name === 'index.html') {
        let html = fs.readFileSync(srcPath, 'utf8');
        const scriptTag = `<script>window.BACKEND_BASE = '${escapeSingle(BACKEND_BASE || "https://bitcguru.onrender.com")}';</script>`;

        // Replace existing BACKEND_BASE script if present
        const replaced = html.replace(/<script>[\s\S]*?window\.BACKEND_BASE\s*=\s*['\"][\s\S]*?['\"];?\s*<\/script>/i, scriptTag);
        if (replaced === html) {
          // insert before </body>
          html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
        } else {
          html = replaced;
        }
        fs.writeFileSync(outPath, html, 'utf8');
      } else {
        fs.copyFileSync(srcPath, outPath);
      }
    }
  }
}

function escapeSingle(s) {
  return (s || '').replace(/'/g, "\\'");
}

try {
  copyAndInject(SRC, OUT);
  console.log('Docs built to', OUT);
} catch (err) {
  console.error(err);
  process.exit(1);
}
