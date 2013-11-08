var walk = require('./walk.js');

module.exports = logWalk;

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
