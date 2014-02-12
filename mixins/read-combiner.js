"use strict";

// This replaces loadAs with a version that batches concurrent requests for
// the same hash.
module.exports = function (repo) {
  var pendingReqs = {};

  var loadAs = repo.loadAs;
  repo.loadAs = newLoadAs;

  function newLoadAs(type, hash, callback) {
    if (!callback) return newLoadAs.bind(null, type, hash);
    var list = pendingReqs[hash];
    if (list) {
      if (list.type !== type) callback(new Error("Type mismatch"));
      else list.push(callback);
      return;
    }
    list = pendingReqs[hash] = [callback];
    list.type = type;
    loadAs.call(repo, type, hash, function () {
      delete pendingReqs[hash];
      for (var i = 0, l = list.length; i < l; i++) {
        list[i].apply(this, arguments);
      }
    });
  }
};
