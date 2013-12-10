var sha1 = require('../lib/sha1.js');
var frame = require('../lib/frame.js');
var deframe = require('../lib/deframe.js');
var encoders = require('../lib/encoders.js');
var decoders = require('../lib/decoders.js');
var parseAscii = require('../lib/parseascii.js');
var isHash = require('../lib/ishash.js');

// Add "objects" capabilities to a repo using db as storage.
module.exports = function (repo) {

  // Add Object store capability to the system
  repo.load = load;       // (hash-ish) -> object
  repo.save = save;       // (object) -> hash
  repo.loadRaw = loadRaw; // (hash) -> buffer
  repo.saveRaw = saveRaw; // (hash, buffer)
  repo.has = has;         // (hash) -> true or false
  repo.loadAs = loadAs;   // (type, hash-ish) -> value
  repo.saveAs = saveAs;   // (type, value) -> hash
  repo.remove = remove;   // (hash)

  // This is a fallback resolve in case there is no refs system installed.
  if (!repo.resolve) repo.resolve = function (hash, callback) {
    if (isHash(hash)) return callback(null, hash);
    return callback(new Error("This repo only supports direct hashes"));
  };

};

function load(hashish, callback) {
  if (!callback) return load.bind(this, hashish);
  var hash;
  var repo = this;
  var db = repo.db;
  return repo.resolve(hashish, onHash);

  function onHash(err, result) {
    if (result === undefined) return callback(err);
    hash = result;
    return db.get(hash, onBuffer);
  }

  function onBuffer(err, buffer) {
    if (buffer === undefined) return callback(err);
    var type, object;
    try {
      if (sha1(buffer) !== hash) {
        throw new Error("Hash checksum failed for " + hash);
      }
      var pair = deframe(buffer);
      type = pair[0];
      buffer = pair[1];
      object = {
        type: type,
        body: decoders[type](buffer)
      };
    } catch (err) {
      if (err) return callback(err);
    }
    return callback(null, object, hash);
  }
}

function loadRaw(hash, callback) {
  return this.db.get(hash, callback);
}

function saveRaw(hash, buffer, callback) {
  return this.db.set(hash, buffer, callback);
}

function has(hash, callback) {
  return this.db.has(hash, callback);
}

function save(object, callback) {
  if (!callback) return save.bind(this, object);
  var buffer, hash;
  var repo = this;
  var db = repo.db;
  try {
    buffer = encoders[object.type](object.body);
    buffer = frame(object.type, buffer);
    hash = sha1(buffer);
  }
  catch (err) {
    return callback(err);
  }
  return db.set(hash, buffer, onSave);

  function onSave(err) {
    if (err) return callback(err);
    if (object.type === 'tag') {
      return db.saveTag(object.body.tag, hash, callback);
    }
    return callback(null, hash);
  }
}

function remove(hash, callback) {
  if (!callback) return remove.bind(this, hash);
  if (!isHash(hash)) return callback(new Error("Invalid hash: " + hash));
  var repo = this;
  var db = repo.db;
  return db.del(hash, callback);
}

function loadAs(type, hashish, callback) {
  if (!callback) return loadAs.bind(this, type, hashish);
  return this.load(hashish, onObject);

  function onObject(err, object, hash) {
    if (object === undefined) return callback(err);
    if (type === "text") {
      type = "blob";
      object.body = parseAscii(object.body, 0, object.body.length);
    }
    if (object.type !== type) {
      return new Error("Expected " + type + ", but found " + object.type);
    }
    return callback(null, object.body, hash);
  }
}

function saveAs(type, body, callback) {
  if (!callback) return saveAs.bind(this, type, body);
  if (type === "text") type = "blob";
  return this.save({ type: type, body: body }, callback);
}
