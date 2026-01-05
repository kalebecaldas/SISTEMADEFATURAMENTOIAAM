const knex = require('knex');
const config = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

// #region agent log
try {
  const filename =
    config[environment] && config[environment].connection
      ? config[environment].connection.filename
      : null;
  // Debug DB connection details (hypothesis H3: wrong DB file)
  fetch('http://127.0.0.1:7245/ingest/c587a5fd-0753-44cb-be2b-c15533efa8d7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'initial',
      hypothesisId: 'H3',
      location: 'backend/database/connection.js:8',
      message: 'DB connection initialized',
      data: { environment, filename },
      timestamp: Date.now()
    })
  }).catch(() => {});
} catch (_) {
  // Ignore logging failures
}
// #endregion

module.exports = db;
