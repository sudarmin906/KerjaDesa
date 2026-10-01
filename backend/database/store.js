const json = require('./jsonStore');
const pg = require('./postgresStore');
const { enabled } = require('./postgres');

function usingPostgres() { return enabled(); }
function ensureStore() { if (!usingPostgres()) json.ensureStore(); }
async function list(resource) { return usingPostgres() ? pg.list(resource) : json.list(resource); }
async function get(resource,id) { return usingPostgres() ? pg.get(resource,id) : json.get(resource,id); }
async function findByField(resource,field,value) { return usingPostgres() ? pg.findByField(resource,field,value) : json.list(resource).find(item => String(item[field]) === String(value)) || null; }
async function create(resource,payload) { return usingPostgres() ? pg.create(resource,payload) : json.create(resource,payload); }
async function update(resource,id,patch) { return usingPostgres() ? pg.update(resource,id,patch) : json.update(resource,id,patch); }
async function remove(resource,id) { return usingPostgres() ? pg.remove(resource,id) : json.remove(resource,id); }
async function count(resource) { return usingPostgres() ? pg.count(resource) : json.list(resource).length; }
async function ensureDatabase() { ensureStore(); if (usingPostgres()) await pg.ensureSchema(); }
module.exports = { usingPostgres, ensureStore, ensureDatabase, list, get, findByField, create, update, remove, count };
