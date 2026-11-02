const fs = require('fs');
const path = require('path');

// A tiny, dependency-free JSON-file store (same idea as the caveman bot).
// Writes go to a temp file first, then get renamed, so a crash can't corrupt it.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function createStore(fileName, defaultValue = {}) {
  const filePath = path.join(DATA_DIR, fileName);

  function ensure() {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }

  function readAll() {
    ensure();
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return JSON.parse(JSON.stringify(defaultValue));
    }
  }

  function writeAll(data) {
    ensure();
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
  }

  return {
    get: (key) => readAll()[key],
    set(key, value) {
      const data = readAll();
      data[key] = value;
      writeAll(data);
    },
    delete(key) {
      const data = readAll();
      delete data[key];
      writeAll(data);
    },
    all: () => readAll(),
    overwriteAll: (data) => writeAll(data),
  };
}

module.exports = createStore;
