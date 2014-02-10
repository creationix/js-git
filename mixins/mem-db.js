/*global define*/
define("js-git/mixins/mem-db", function () {
  "use strict";

  var defer = require('js-git/lib/defer');
  var encoders = require('js-git/lib/encoders');

  mixin.saveAs = saveAs;
  mixin.loadAs = loadAs;
  return mixin;

  function mixin(repo) {
    var objects = repo.objects = {};
    var types = {};

    repo.saveAs = saveAs;
    repo.loadAs = loadAs;

    function saveAs(type, body, callback, hashOverride) {
      if (!callback) return saveAs.bind(this, type, body);
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
      if (!callback) return loadAs.bind(this, type, hash);
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


});
