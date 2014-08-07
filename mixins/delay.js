"use strict";

module.exports = function (repo, ms) {
  var saveAs = repo.saveAs;
  var loadAs = repo.loadAs;
  var readRef = repo.readRef;
  var updateRef = repo.updateRef;
  var createTree = repo.createTree;

  repo.saveAs = saveAsDelayed;
  repo.loadAs = loadAsDelayed;
  repo.readRef = readRefDelayed;
  repo.updateRed = updateRefDelayed;
  if (createTree) repo.createTree = createTreeDelayed;

  function saveAsDelayed(type, value, callback) {
    if (!callback) return saveAsDelayed.bind(repo, type, value);
    setTimeout(function () {
      return saveAs.call(repo, type, value, callback);
    }, ms);
  }

  function loadAsDelayed(type, hash, callback) {
    if (!callback) return loadAsDelayed.bind(repo, type, hash);
    setTimeout(function () {
      return loadAs.call(repo, type, hash, callback);
    }, ms);
  }

  function readRefDelayed(ref, callback) {
    if (!callback) return readRefDelayed.bind(repo, ref);
    setTimeout(function () {
      return readRef.call(repo, ref, callback);
    }, ms);
  }

  function updateRefDelayed(ref, hash, callback) {
    if (!callback) return updateRefDelayed.bind(repo, ref, hash);
    setTimeout(function () {
      return updateRef.call(repo, ref, hash, callback);
    }, ms);
  }

  function createTreeDelayed(entries, callback) {
    if (!callback) return createTreeDelayed.bind(repo, entries);
    setTimeout(function () {
      return createTree.call(repo, entries, callback);
    }, ms);
  }

};
