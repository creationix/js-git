"use strict";

module.exports = function (repo, ms) {
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
    setTimeout(function () {
      return saveAs.call(repo, type, value, callback);
    }, ms);
  }

  function loadASDelayed(type, hash, callback) {
    setTimeout(function () {
      return loadAs.call(repo, type, hash, callback);
    }, ms);
  }

  function readRefDelayed(ref, callback) {
    setTimeout(function () {
      return readRef.call(repo, ref, callback);
    }, ms);
  }

  function updateRefDelayed(ref, hash, callback) {
    setTimeout(function () {
      return updateRef.call(repo, ref, hash, callback);
    }, ms);
  }

  function createTreeDelayed(entries, callback) {
    setTimeout(function () {
      return createTree.call(repo, entries, callback);
    }, ms);
  }

};
