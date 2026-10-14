/**
 * Runs automatically before "npm run dev".
 * Checks the usual set-up mistakes and explains how to fix them in plain words.
 */
const fs = require('fs');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');
const problems = [];
const ok = (m) => console.log(`  ✔ ${m}`);

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) problems.push(`Node.js ${process.versions.node} is too old. Install the LTS version (20 or 22) from https://nodejs.org and restart VS Code.`);
else ok(`Node.js ${process.versions.node}`);

for (const dir of ['', 'backend', 'frontend']) {
  if (!fs.existsSync(path.join(root, dir, 'node_modules'))) {
    problems.push(`Packages are not installed${dir ? ` in /${dir}` : ''}. Run:  npm run setup`);
  }
}
if (!problems.some((p) => p.includes('Packages'))) ok('Packages installed');

const env = path.join(root, 'backend', '.env');
if (!fs.existsSync(env)) {
  fs.copyFileSync(path.join(root, 'backend', '.env.example'), env);
  ok('Created backend/.env from .env.example');
} else ok('backend/.env found');

const portFree = (port) => new Promise((resolve) => {
  const srv = net.createServer();
  srv.once('error', () => resolve(false));
  srv.once('listening', () => srv.close(() => resolve(true)));
  srv.listen(port);
});

(async () => {
  for (const port of [5000, 5173]) {
    if (!(await portFree(port))) {
      problems.push(`Port ${port} is already in use – the project is probably already running in another terminal. Close that terminal (or press Ctrl+C in it) and try again.`);
    }
  }
  if (problems.length) {
    console.log('\n❌ Cannot start yet:\n');
    problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log('');
    process.exit(1);
  }
  ok('Ports 5000 and 5173 are free');
  console.log('\n🚀 Starting backend (port 5000) and frontend (port 5173)…  Open http://localhost:5173 when you see "Local:"\n');
})();
