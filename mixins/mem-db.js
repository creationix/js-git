"use strict";

var defer = require('../lib/defer.js');
var codec = require('../lib/object-codec.js');
var sha1 = require('git-sha1');

module.exports = mixin;
var isHash = /^[0-9a-f]{40}$/;

function mixin(repo) {
  var objects = {};
  var refs = {};

  repo.saveAs = saveAs;
  repo.loadAs = loadAs;
  repo.saveRaw = saveRaw;
  repo.loadRaw = loadRaw;
  repo.hasHash = hasHash;
  repo.readRef = readRef;
  repo.updateRef = updateRef;
  repo.listRefs = listRefs;

  function readRef(ref, callback) {
    return makeAsync(function () {
      return refs[ref];
    }, callback);
  }

  function listRefs(prefix, callback) {
    return makeAsync(function () {
      var regex = prefix && new RegExp("^" + prefix + "[/$]");
      var out = {};
      Object.keys(refs).forEach(function (name) {
        if (regex && !regex.test(name)) return;
        out[name] = refs[name];
      });
      return out;
    }, callback);
  }

  function updateRef(ref, hash, callback) {
    return makeAsync(function () {
      return (refs[ref] = hash);
    }, callback);
  }

  function hasHash(hash, callback) {
    return makeAsync(function () {
      if (!isHash.test(hash)) hash = refs[hash];
      return hash in objects;
    }, callback);
  }

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
      if (!isHash.test(hash)) hash = refs[hash];
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
