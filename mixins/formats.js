"use strict";

var binary = require('../lib/binary.js');

module.exports = function (repo) {
  var loadAs = repo.loadAs;
  repo.loadAs = newLoadAs;
  function newLoadAs(type, hash, callback) {
    var realType = type === "text" ? "blob":
                   type === "array" ? "tree" : type;
    return loadAs.call(repo, realType, hash, onLoad);

    function onLoad(err, body, hash) {
      if (body === undefined) return callback(err);
      if (type === "text") body = binary.toUnicode(body);
      if (type === "array") body = toArray(body);
      return callback(err, body, hash);
    }
  }
};

function toArray(tree) {
  return Object.keys(tree).map(function (name) {
    var entry = tree[name];
    entry.name = name;
    return entry;
  });
}
