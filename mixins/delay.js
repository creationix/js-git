/*global define*/
define("js-git/mixins/delay", function () {
  "use strict";

  return function (repo, ms) {
    var saveAs = repo.saveAs;
    var loadAs = repo.loadAs;
    var readRef = repo.readRef;
    var updateRef = repo.updateRef;
    var createTree = repo.createTree;

    repo.saveAs = saveAsDelayed;
    repo.loadAs = loadASDelayed;
    repo.readRef = readRefDelayed;
    repo.updateRed = updateRefDelayed;
    if (createTree) repo.createTree = createTreeDelayed;

    function saveAsDelayed(type, value, callback) {
      if (!callback) return saveAsDelayed.bind(null, type, value);
      setTimeout(function () {
        return saveAs.call(repo, type, value, callback);
      }, ms);
    }

    function loadASDelayed(type, hash, callback) {
      if (!callback) return loadASDelayed.bind(null, type, hash);
      setTimeout(function () {
        return loadAs.call(repo, type, hash, callback);
      }, ms);
    }

    function readRefDelayed(ref, callback) {
      if (!callback) return readRefDelayed.bind(null, ref);
      setTimeout(function () {
        return readRef.call(repo, ref, callback);
      }, ms);
    }

    function updateRefDelayed(ref, hash, callback) {
      if (!callback) return updateRefDelayed.bind(null, ref, hash);
      setTimeout(function () {
        return updateRef.call(repo, ref, hash, callback);
      }, ms);
    }

    function createTreeDelayed(entries, callback) {
      if (!callback) return createTreeDelayed.bind(null, entries);
      setTimeout(function () {
        return createTree.call(repo, entries, callback);
      }, ms);
    }

  };

});