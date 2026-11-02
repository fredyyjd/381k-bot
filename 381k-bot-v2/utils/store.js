const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'data.json');
fs.mkdirSync(path.dirname(file), { recursive: true });

let db = {};
try {
  db = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch {
  db = {};
}

let timer = null;

function save() {
  clearTimeout(timer);
  timer = setTimeout(() => fs.writeFile(file, JSON.stringify(db), () => {}), 500);
}

function flush() {
  try {
    fs.writeFileSync(file, JSON.stringify(db));
  } catch {}
}

const defaults = () => ({
  cfg: {},
  counter: 0,
  appCounter: 0,
  tickets: {},
  apps: {},
  strikes: {},
  partner: {},
  schematic: { week: '', points: {} },
  activity: null,
  levels: {}
});

function guild(id) {
  if (!db[id]) db[id] = defaults();
  const g = db[id];
  for (const [key, value] of Object.entries(defaults())) {
    if (g[key] === undefined) g[key] = value;
  }
  return g;
}

function all() {
  return Object.keys(db);
}

process.on('SIGINT', () => {
  flush();
  process.exit(0);
});

process.on('SIGTERM', () => {
  flush();
  process.exit(0);
});

module.exports = { guild, save, all, flush };
