'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../lib/config');

let db;

function connect() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

function isSeeded() {
  const d = connect();
  const row = d.prepare("SELECT count(*) AS n FROM products").get();
  return row.n > 0;
}

function transaction(fn) {
  const d = connect();
  return d.transaction(fn)();
}

module.exports = { connect, isSeeded, transaction, get db() { return connect(); } };
