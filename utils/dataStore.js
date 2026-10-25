// ============================================
// DATA STORE UTILITY
// Thread-safe JSON read/write with atomic writes
// ============================================
const fs = require('fs');
const path = require('path');

// Simple write lock implementation
const locks = {};

function acquireLock(filePath) {
  return new Promise((resolve) => {
    const check = () => {
      if (!locks[filePath]) {
        locks[filePath] = true;
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

function releaseLock(filePath) {
  delete locks[filePath];
}

async function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return [];
  }
}

async function writeJSON(filePath, data) {
  await acquireLock(filePath);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    throw err;
  } finally {
    releaseLock(filePath);
  }
}

module.exports = { readJSON, writeJSON };
