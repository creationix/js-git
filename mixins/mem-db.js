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
    return makeAsync(function () {
      var buffer = codec.frame({type:type,body:body});
      var hash = sha1(buffer);
      objects[hash] = buffer;
      return hash;
    }, callback);
  }

  function saveRaw(hash, buffer, callback) {
    return makeAsync(function () {
      objects[hash] = buffer;
    }, callback);
  }

  function loadAs(type, hash, callback) {
    return makeAsync(function () {
      var buffer = objects[hash];
      if (!buffer) return [];
      var obj = codec.deframe(buffer, true);
      if (obj.type !== type) throw new TypeError("Type mismatch");
      return obj.body;
    }, callback);
  }

  function loadRaw(hash, callback) {
    return makeAsync(function () {
      return objects[hash];
    }, callback);
  }
}

function makeAsync(fn, callback) {
  if (!callback) return makeAsync.bind(null, fn);
  defer(function () {
    var out;
    try { out = fn(); }
    catch (err) { return callback(err); }
    callback(null, out);
  });
}
