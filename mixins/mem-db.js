"use strict";

var defer = require('../lib/defer.js');
var encoders = require('../lib/encoders.js');

module.exports = mixin;

function mixin(repo) {
  var objects = repo.objects = {};
  var types = {};

  repo.saveAs = saveAs;
  repo.loadAs = loadAs;

  function saveAs(type, body, callback, hashOverride) {
    defer(function () {
      var hash;
      try {
        body = encoders.normalizeAs(type, body);
        hash = hashOverride || encoders.hashAs(type, body);
      }
      catch (err) { return callback(err); }
      objects[hash] = body;
      types[hash] = type;
      callback(null, hash, body);
    });
  }

  function loadAs(type, hash, callback) {
    defer(function () {
      var realType = (type === "text" || type === "raw") ? "blob" : type;
      if (!types[hash]) return callback();
      if (realType !== types[hash]) return callback(new TypeError("Type mismatch"));
      var result = objects[hash];
      if (type !== "blob") result = encoders.normalizeAs(type, result);
      callback(null, result, hash);
    });
  }
}
