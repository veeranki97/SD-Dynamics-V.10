/**
 * One-time: node patch-mail-routes.mjs
 * Run from _system folder. Adds mail routes to server.js if missing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

if (s.includes("/api/mail/settings") && s.includes("registerMailRoutes")) {
  console.log('Already patched (registerMailRoutes).');
  process.exit(0);
}

if (s.includes("/api/mail/settings") && s.includes("app.post('/api/mail/send'")) {
  console.log('Mail routes already inline in server.js. Restart node server.js');
  process.exit(0);
}

// Ensure mailRoutes.js exists next to server or in src/
const candidates = [
  path.join(__dirname, 'src', 'mailRoutes.js'),
  path.join(__dirname, 'mailRoutes.js'),
];
// Copy from this script's folder if needed - assume user copied mailRoutes to src/

const importLine = `import { registerMailRoutes } from './src/mailRoutes.js';\n`;
if (!s.includes('registerMailRoutes')) {
  // after express app created - find "const app = express" or "app.use(express.json"
  if (s.includes("from 'express'") || s.includes('from "express"')) {
    // add import near other imports
    const m = s.match(/^import .+;\n/m);
    if (m) {
      const idx = s.indexOf(m[0]) + m[0].length;
      // find last import
      let last = 0;
      const re = /^import .+$/gm;
      let mm;
      while ((mm = re.exec(s))) last = mm.index + mm[0].length;
      s = s.slice(0, last) + '\n' + importLine + s.slice(last);
    } else {
      s = importLine + s;
    }
  }
}

const registerCall = `
// SD Dynamics — SMTP mail API
try {
  registerMailRoutes(app, { readJSON, writeJSON, META_PATH });
} catch (e) {
  console.warn('[mail] register failed:', e.message);
}
`;

if (!s.includes('registerMailRoutes(app')) {
  // Insert before "No such endpoint" catch-all
  const marker = "No such endpoint";
  const i = s.indexOf(marker);
  if (i > 0) {
    // find start of that handler - go back to app.get or app.use
    const before = s.lastIndexOf('\napp.', i);
    if (before > 0) {
      s = s.slice(0, before) + '\n' + registerCall + s.slice(before);
    } else {
      s = s + '\n' + registerCall;
    }
  } else {
    // before startServer
    const j = s.indexOf('function startServer');
    if (j > 0) s = s.slice(0, j) + registerCall + '\n' + s.slice(j);
    else s += registerCall;
  }
}

fs.writeFileSync(serverPath, s);
console.log('Patched server.js — restart: node server.js');
console.log('Test: http://localhost:PORT/api/mail/settings');
