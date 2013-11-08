var walk = require('./walk.js');
var assertType = require('./assert-type.js');

module.exports = treeWalk;

function treeWalk(hashish, callback) {
  if (!callback) return treeWalk.bind(this, hashish);
  var repo = this;
  return repo.load(hashish, onLoad);
  function onLoad(err, item, hash) {
    if (err) return callback(err);
    if (item.type === "commit") return repo.load(item.body.tree, onLoad);
    item.hash = hash;
    item.path = "/";
    return callback(null, walk(item, treeScan, treeLoadKey, treeCompare));
  }

  function treeLoadKey(entry, callback) {
    return repo.load(entry.hash, function (err, object) {
      if (err) return callback(err);
      entry.type = object.type;
      entry.body = object.body;
      return callback(null, entry);
    });
  }

}

function treeScan(object) {
  if (object.type === "blob") return [];
  assertType(object, "tree");
  return object.body.filter(function (entry) {
    return entry.mode !== 0160000;
  }).map(function (entry) {
    var path = object.path + entry.name;
    if (entry.mode === 040000) path += "/";
    entry.path = path;
    return entry;
  });
}

function treeCompare(first, second) {
  return first.path < second.path;
}

