/*global define*/
define("js-git/mixins/mem-cache", function () {
  "use strict";
  var normalizeAs = require('js-git/lib/encoders').normalizeAs;
  var hashAs = require('js-git/lib/encoders').hashAs;

  var cache = {};
  return function (repo) {
    var saved = {};
    var loadAs = repo.loadAs;
    repo.loadAs = loadAsCached;
    function loadAsCached(type, hash, callback) {
      if (!callback) return loadAsCached.bind(this, type, hash);
      if (hash in cache) return callback(null, dupe(type, cache[hash]));
      loadAs.call(repo, type, hash, function (err, value) {
        if (err) return callback(err);
        if (type !== "blob" || value.length < 100) {
          cache[hash] = value;
        }
        return callback.apply(this, arguments);
      });
    }

    var saveAs = repo.saveAs;
    repo.saveAs = saveAsCached;
    function saveAsCached(type, value, callback) {
      if (!callback) return saveAsCached.bind(this, type, value);
      // var hash = hashAs(type, value);
      // if (saved[hash]) return callback(null, hash, dupe(value));
      saveAs.call(repo, type, value, function (err, hash, value) {
        if (err) return callback(err);
        if (type !== "blob" || value.length < 100) {
          cache[hash] = value;
        }
        saved[hash] = true;
        return callback.apply(this, arguments);
      });
    }
  };


  function dupe(type, value) {
    if (type === "blob") return value;
    return normalizeAs(type, value);
  }

});
