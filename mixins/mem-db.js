"use strict";

var defer = require('../lib/defer.js');
var codec = require('../lib/object-codec.js');
var sha1 = require('git-sha1');

module.exports = mixin;

function mixin(repo) {
  var objects = {};

  repo.saveAs = saveAs;
  repo.loadAs = loadAs;
  repo.saveRaw = saveRaw;
  repo.loadRaw = loadRaw;

  function saveAs(type, body, callback) {
    makeAsync(function () {
      var buffer = codec.frame({type:type,body:body});
      var hash = sha1(buffer);
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
      var obj = codec.deframe(buffer, true);
      if (obj.type !== type) throw new TypeError("Type mismatch");
      return [obj.body, hash];
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
