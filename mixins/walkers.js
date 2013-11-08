var walk = require('../lib/walk.js');
var assertType = require('../lib/assert-type.js');

module.exports = function (repo) {
  repo.logWalk = logWalk;   // (hash-ish) => stream<commit>
  repo.treeWalk = treeWalk; // (hash-ish) => stream<object>
};

function logWalk(hashish, callback) {
  if (!callback) return logWalk.bind(this, hashish);
  var last, seen = {};
  var repo = this;
  return repo.readRef("shallow", onShallow);

  function onShallow(err, shallow) {
    last = shallow;
    return repo.loadAs("commit", hashish, onLoad);
  }

  function onLoad(err, commit, hash) {
    if (commit === undefined) return callback(err);
    commit.hash = hash;
    seen[hash] = true;
    return callback(null, walk(commit, scan, loadKey, compare));
  }

  function scan(commit) {
    if (last === commit) return [];
    return commit.parents.filter(function (hash) {
      return !seen[hash];
    });
  }

  function loadKey(hash, callback) {
    return repo.loadAs("commit", hash, function (err, commit) {
      if (err) return callback(err);
      commit.hash = hash;
      if (hash === last) commit.last = true;
      return callback(null, commit);
    });
  }

}

function compare(commit, other) {
  return commit.author.date < other.author.date;
}

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

