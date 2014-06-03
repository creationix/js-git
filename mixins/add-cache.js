"use strict";

module.exports = addCache;
function addCache(repo, cache) {
  var loadAs = repo.loadAs;
  if (loadAs) repo.loadAs = loadAsCached;
  var saveAs = repo.saveAs;
  if (saveAs) repo.saveAs = saveAsCached;
  var createTree = repo.createTree;
  if (createTree) repo.createTree = createTreeCached;

  function loadAsCached(type, hash, callback) {
    // Next check in disk cache...
    cache.loadAs(type, hash, onCacheLoad);

    function onCacheLoad(err, value) {
      if (err) return callback(err);
      // ...and return if it's there.
      if (value !== undefined) {
        return callback(null, value, hash);
      }

      // Otherwise load from real data source...
      loadAs.call(repo, type, hash, onLoad);
    }

    function onLoad(err, value) {
      if (value === undefined) return callback(err);

      // Store it on disk too...
      // Force the hash to prevent mismatches.
      cache.saveAs(type, value, onSave, hash);

      function onSave(err) {
        if (err) return callback(err);
        // Finally return the value to caller.
        callback(null, value, hash);
      }
    }
  }

  function saveAsCached(type, value, callback) {
    saveAs.call(repo, type, value, onSave);

    function onSave(err, hash) {
      if (err) return callback(err);
      // Store in disk, forcing hash to match.
      cache.saveAs(type, value, callback, hash);
    }
  }

  function createTreeCached(entries, callback) {
    createTree.call(repo, entries, onTree);

    function onTree(err, hash, tree) {
      if (err) return callback(err);
      cache.saveAs("tree", tree, callback, hash);
    }
  }

}
