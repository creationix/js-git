/*global define*/
define("js-git/mixins/add-cache", function () {

  return addCache;
  function addCache(repo, cache) {
    var loadAs = repo.loadAs;
    if (loadAs) repo.loadAs = loadAsCached;
    var saveAs = repo.saveAs;
    if (saveAs) repo.saveAs = saveAsCached;
    var createTree = repo.createTree;
    if (createTree) repo.createTree = createTreeCached;

    function loadAsCached(type, hash, callback) {
      if (!callback) return loadAsCached.bind(this, type, hash);
      cache.loadAs(type, hash, function (err, value) {
        if (err) return callback(err);
        if (value !== undefined) {
          return callback(null, value, hash);
        }
        loadAs.call(repo, type, hash, function (err, value) {
          if (err) return callback(err);
          cache.saveAs(type, value, function (err) {
            if (err) return callback(err);
            callback(null, value, hash);
          }, hash);
        });
      });
    }

    function saveAsCached(type, value, callback) {
      saveAs.call(repo, type, value, function (err, hash) {
        if (err) return callback(err);
        cache.saveAs(type, value, callback, hash);
      });
    }

    function createTreeCached(entries, callback) {
      createTree.call(repo, entries, function (err, hash, tree) {
        if (err) return callback(err);
        cache.saveAs("tree", tree, callback, hash);
      });
    }

  }

});
