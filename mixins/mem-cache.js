"use strict";
var normalizeAs = require('../lib/encoders.js').normalizeAs;

var cache = {};
module.exports = function (repo) {
  var loadAs = repo.loadAs;
  repo.loadAs = loadAsCached;
  function loadAsCached(type, hash, callback) {
    if (hash in cache) return callback(null, dupe(type, cache[hash]), hash);
    loadAs.call(repo, type, hash, function (err, value) {
      if (err) return callback(err);
      if (type !== "blob" || value.length < 100) {
        if (type === "blob") value = new Uint8Array(value);
        cache[hash] = value;
      }
      return callback.apply(this, arguments);
    });
  }

  var saveAs = repo.saveAs;
  repo.saveAs = saveAsCached;
  function saveAsCached(type, value, callback) {
    saveAs.call(repo, type, value, function (err, hash, value) {
      if (err) return callback(err);
      if (type !== "blob" || value.length < 100) {
        if (type === "blob") value = new Uint8Array(value);
        cache[hash] = value;
      }
      return callback.apply(this, arguments);
    });
  }
};

function dupe(type, value) {
  if (type === "blob") {
    return new Uint8Array(value);
  }
  return normalizeAs(type, value);
}
