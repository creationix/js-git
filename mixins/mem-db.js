"use strict";

var binary = require('bodec');
var defer = require('../lib/defer.js');
var encoders = require('../lib/encoders.js');
var deframe = require('../lib/deframe.js');
var decoders = require('../lib/decoders.js');
var sha1 = require('git-sha1');

module.exports = mixin;

function mixin(repo) {
  var objects = {};

  repo.saveAs = saveAs;
  repo.loadAs = loadAs;
  repo.saveRaw = saveRaw;
  repo.loadRaw = loadRaw;

  function saveAs(type, body, callback, hashOverride) {
    makeAsync(function () {
      body = encoders.normalizeAs(type, body);
      var buffer = encoders.encodeAs(type, body);
      buffer = binary.join([
        encoders.frame(type, buffer.length),
        buffer
      ]);
      var hash = hashOverride || sha1(buffer);
      objects[hash] = buffer;
      return [hash, body];
    }, callback);
  }

  function saveRaw(hash, buffer, callback) {
    makeAsync(function () {
      objects[hash] = buffer;
      return [];
    }, callback);
  }

  function loadAs(type, hash, callback) {
    makeAsync(function () {
      var buffer = objects[hash];
      if (!buffer) return [];
      var parts = deframe(buffer);
      if (parts[0] !== type) throw new TypeError("Type mismatch");
      var body = decoders[type](parts[1]);
      return [body, hash];
    }, callback);
  }

  function loadRaw(hash, callback) {
    makeAsync(function () {
      return [objects[hash]];
    }, callback);
  }
}

function makeAsync(fn, callback) {
  defer(function () {
    var out;
    try { out = fn(); }
    catch (err) { return callback(err); }
    callback.call(null, null, out[0], out[1]);
  });
}
