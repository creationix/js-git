var sha1 = require('../lib/sha1.js');
var frame = require('../lib/frame.js');
var deframe = require('../lib/deframe.js');
var encoders = require('../lib/encoders.js');
var decoders = require('../lib/decoders.js');
var parseAscii = require('../lib/parseascii.js');
var isHash = require('../lib/ishash.js');

// Add "objects" capabilities to a repo using db as storage.
module.exports = function (repo) {

  if (typeof repo.loadRaw !== "function") {
    throw new TypeError("OBJECTS mixin depends on repo.loadRaw(hash) -> buffer");
  }
  if (typeof repo.saveRaw !== "function") {
    throw new TypeError("OBJECTS mixin depends on repo.saveRaw(hash, buffer)");
  }
  if (typeof repo.has !== "function") {
    throw new TypeError("OBJECTS mixin depends on repo.has(hash) -> boolean");
  }
  if (typeof repo.remove !== "function") {
    throw new TypeError("OBJECTS mixin depends on repo.remove(hash)");
  }

  // Add Object store capability to the system
  repo.load = load;       // (hash-ish) -> {type,value}
  repo.save = save;       // ({type,value}) -> hash
  repo.loadAs = loadAs;   // (type, hash-ish) -> value
  repo.saveAs = saveAs;   // (type, value) -> hash

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
  return repo.resolve(hashish, onHash);

  function onHash(err, result) {
    if (result === undefined) return callback(err);
    hash = result;
    return repo.loadRaw(hash, onBuffer);
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

function save(object, callback) {
  if (!callback) return save.bind(this, object);
  var buffer, hash;
  var repo = this;
  try {
    buffer = encoders[object.type](object.body);
    buffer = frame(object.type, buffer);
    hash = sha1(buffer);
  }
  catch (err) {
    return callback(err);
  }
  return repo.saveRaw(hash, buffer, onSave);

  function onSave(err) {
    if (err) return callback(err);
    return callback(null, hash);
  }
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
