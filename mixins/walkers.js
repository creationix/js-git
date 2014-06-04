var modes = require('../lib/modes.js');

module.exports = function (repo) {
  repo.logWalk = logWalk;   // (ref) => stream<commit>
  repo.treeWalk = treeWalk; // (treeHash) => stream<object>
};
module.exports.walk = walk;

function logWalk(ref, callback) {
  if (!callback) return logWalk.bind(this, ref);
  var last, seen = {};
  var repo = this;
  if (!repo.readRef) return onShallow();
  return repo.readRef("shallow", onShallow);

  function onShallow(err, shallow) {
    last = shallow;
    resolveRef(repo, ref, onHash);
  }

  function onHash(err, hash) {
    if (err) return callback(err);
    return repo.loadAs("commit", hash, function (err, commit) {
      if (commit === undefined) return callback(err);
      commit.hash = hash;
      seen[hash] = true;
      return callback(null, walk(commit, scan, loadKey, compare));
    });
  }

  function scan(commit) {
    if (last === commit) return [];
    return commit.parents.filter(function (hash) {
      return !seen[hash];
    });
  }

  function loadKey(hash, callback) {
    return repo.loadAs("commit", hash, function (err, commit) {
      if (!commit) return callback(err || new Error("Missing commit " + hash));
      commit.hash = hash;
      if (hash === last) commit.last = true;
      return callback(null, commit);
    });
  }

}

function compare(commit, other) {
  return commit.author.date < other.author.date;
}

function treeWalk(hash, callback) {
  if (!callback) return treeWalk.bind(this, hash);
  var repo = this;
  return repo.loadAs("tree", hash, onTree);

  function onTree(err, body) {
    if (!body) return callback(err || new Error("Missing tree " + hash));
    var tree = {
      mode: modes.tree,
      hash: hash,
      body: body,
      path: "/"
    };
    return callback(null, walk(tree, treeScan, treeLoadKey, treeCompare));
  }

  function treeLoadKey(entry, callback) {
    if (entry.mode !== modes.tree) return callback(null, entry);
    var type = modes.toType(entry.mode);
    return repo.loadAs(type, entry.hash, function (err, body) {
      if (err) return callback(err);
      entry.body = body;
      return callback(null, entry);
    });
  }

}

function treeScan(object) {
  if (object.mode !== modes.tree) return [];
  var tree = object.body;
  return Object.keys(tree).map(function (name) {
    var entry = tree[name];
    var path = object.path + name;
    if (entry.mode === modes.tree) path += "/";
    return {
      mode: entry.mode,
      hash: entry.hash,
      path: path
    };
  });
}

function treeCompare(first, second) {
  return first.path < second.path;
}

function resolveRef(repo, hashish, callback) {
  if (/^[0-9a-f]{40}$/.test(hashish)) {
    return callback(null, hashish);
  }
  repo.readRef(hashish, function (err, hash) {
    if (!hash) return callback(err || new Error("Bad ref " + hashish));
    callback(null, hash);
  });
}

function walk(seed, scan, loadKey, compare) {
  var queue = [seed];
  var working = 0, error, cb;
  return {read: read, abort: abort};

  function read(callback) {
    if (!callback) return read;
    if (cb) return callback(new Error("Only one read at a time"));
    if (working) { cb = callback; return; }
    var item = queue.shift();
    if (!item) return callback();
    try { scan(item).forEach(onKey); }
    catch (err) { return callback(err); }
    return callback(null, item);
  }

  function abort(callback) { return callback(); }

  function onError(err) {
    if (cb) {
      var callback = cb; cb = null;
      return callback(err);
    }
    error = err;
  }

  function onKey(key) {
    working++;
    loadKey(key, onItem);
  }

  function onItem(err, item) {
    working--;
    if (err) return onError(err);
    var index = queue.length;
    while (index && compare(item, queue[index - 1])) index--;
    queue.splice(index, 0, item);
    if (!working && cb) {
      var callback = cb; cb = null;
      return read(callback);
    }
  }
}
