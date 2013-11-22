var isHash = require('../lib/ishash.js');

module.exports = function (repo) {
  // Refs
  repo.resolve = resolve;       // (hash-ish) -> hash
  repo.updateHead = updateHead; // (hash)
  repo.getHead = getHead;       // () -> ref
  repo.setHead = setHead;       // (ref)
  repo.readRef = readRef;       // (ref) -> hash
  repo.createRef = createRef;   // (ref, hash)
  repo.updateRef = updateRef;   // (ref, hash)
  repo.deleteRef = deleteRef;   // (ref)
  repo.listRefs = listRefs;     // (prefix) -> refs
};

function resolve(hashish, callback) {
  if (!callback) return resolve.bind(this, hashish);
  hashish = hashish.trim();
  var repo = this, db = repo.db;
  if (isHash(hashish)) return callback(null, hashish);
  if (hashish === "HEAD") return repo.getHead(onBranch);
  if ((/^refs\//).test(hashish)) {
    return db.get(hashish, checkBranch);
  }
  return checkBranch();

  function onBranch(err, ref) {
    if (err) return callback(err);
    if (!ref) return callback();
    return repo.resolve(ref, callback);
  }

  function checkBranch(err, hash) {
    if (err && err.code !== "ENOENT") return callback(err);
    if (hash) {
      return repo.resolve(hash, callback);
    }
    return db.get("refs/heads/" + hashish, checkTag);
  }

  function checkTag(err, hash) {
    if (err && err.code !== "ENOENT") return callback(err);
    if (hash) {
      return repo.resolve(hash, callback);
    }
    return db.get("refs/tags/" + hashish, final);
  }

  function final(err, hash) {
    if (err) return callback(err);
    if (hash) {
      return repo.resolve(hash, callback);
    }
    err = new Error("ENOENT: Cannot find " + hashish);
    err.code = "ENOENT";
    return callback(err);
  }
}

function updateHead(hash, callback) {
  if (!callback) return updateHead.bind(this, hash);
  var ref;
  var repo = this, db = repo.db;
  return this.getHead(onBranch);

  function onBranch(err, result) {
    if (err) return callback(err);
    if (result === undefined) {
      return repo.setHead("master", function (err) {
        if (err) return callback(err);
        onBranch(err, "refs/heads/master");
      });
    }
    ref = result;
    return db.set(ref, hash + "\n", callback);
  }
}

function getHead(callback) {
  if (!callback) return getHead.bind(this);
  var repo = this, db = repo.db;
  return db.get("HEAD", onRead);

  function onRead(err, ref) {
    if (err) return callback(err);
    if (!ref) return callback();
    var match = ref.match(/^ref: *(.*)/);
    if (!match) return callback(new Error("Invalid HEAD"));
    return callback(null, match[1]);
  }
}

function setHead(branchName, callback) {
  if (!callback) return setHead.bind(this, branchName);
  var ref = "refs/heads/" + branchName;
  return this.db.set("HEAD", "ref: " + ref + "\n", callback);
}

function readRef(ref, callback) {
  if (!callback) return readRef.bind(this, ref);
  return this.db.get(ref, function (err, result) {
    if (err) return callback(err);
    if (!result) return callback();
    return callback(null, result.trim());
  });
}

function createRef(ref, hash, callback) {
  if (!callback) return createRef.bind(this, ref, hash);
  // TODO: should we check to make sure it doesn't exist first?
  return this.db.set(ref, hash + "\n", callback);
}

function updateRef(ref, hash, callback) {
  if (!callback) return updateRef.bind(this, ref, hash);
  // TODO: should we check to make sure it does exist first?
  return this.db.set(ref, hash + "\n", callback);
}

function deleteRef(ref, callback) {
  if (!callback) return deleteRef.bind(this, ref);
  return this.db.del(ref, callback);
}

function listRefs(prefix, callback) {
  if (!callback) return listRefs.bind(this, prefix);
  if (!prefix) prefix = "refs\/";
  else if (!/^refs\//.test(prefix)) {
    return callback(new TypeError("Invalid prefix: " + prefix));
  }
  var db = this.db;
  var refs = {};
  return db.keys(prefix, onKeys);

  function onKeys(err, keys) {
    if (err) return callback(err);
    var left = keys.length, done = false;
    if (!left) return callback(null, refs);
    keys.forEach(function (key) {
      db.get(key, function (err, value) {
        if (done) return;
        if (err) {
          done = true;
          return callback(err);
        }
        refs[key] = value.trim();
        if (--left) return;
        done = true;
        callback(null, refs);
      });
    });
  }
}
