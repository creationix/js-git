var parseAscii = require('./lib/parseascii.js');
var encoders = require('./lib/encoders.js');
var decoders = require('./lib/decoders.js');
var frame = require('./lib/frame.js');
var deframe = require('./lib/deframe.js');
var sha1 = require('./lib/sha1.js');
var trace = require('./lib/trace.js');
var treeWalk = require('./lib/tree-walk.js');
var logWalk = require('./lib/log-walk.js');
var fetch = require('./lib/fetch.js');
var push = require('./lib/push.js');
var unpack = require('./lib/unpack.js');

module.exports = newRepo;

function newRepo(db) {
  if (!db) throw new TypeError("A db interface instance is required");

  var repo = {};

  repo.db = db;

  if (trace) db = require('./lib/tracedb.js')(db);

  // Git Objects
  repo.load = load;       // (hash-ish) -> object
  repo.save = save;       // (object) -> hash
  repo.loadAs = loadAs;   // (type, hash-ish) -> value
  repo.saveAs = saveAs;   // (type, value) -> hash
  repo.remove = remove;   // (hash-ish)
  repo.unpack = unpack;   // (opts, packStream)

  // Convenience Readers
  repo.logWalk = logWalk;   // (hash-ish) => stream<commit>
  repo.treeWalk = treeWalk; // (hash-ish) => stream<object>

  // Refs
  repo.resolveHashish = resolveHashish; // (hash-ish) -> hash
  repo.updateHead = updateHead;         // (hash)
  repo.getHead = getHead;               // () -> ref
  repo.setHead = setHead;               // (ref)
  repo.readRef = readRef;               // (ref) -> hash
  repo.createRef = createRef;           // (ref, hash)
  repo.deleteRef = deleteRef;           // (ref)
  repo.listRefs = listRefs;             // (prefix) -> refs

  // Network Protocols
  repo.fetch = fetch;
  repo.push = push;

  return repo;

  function load(hashish, callback) {
    if (!callback) return load.bind(this, hashish);
    var hash;
    return resolveHashish(hashish, onHash);

    function onHash(err, result) {
      if (result === undefined) return callback(err);
      hash = result;
      return db.get(hash, onBuffer);
    }

    function onBuffer(err, buffer) {
      if (err) return callback(err);
      var type, object;
      try {
        if (sha1(buffer) !== hash) {
          throw new Error("Hash checksum failed for " + hash);
        }
        var pair = deframe(buffer);
        type = pair[0];
        buffer = pair[1];
        object = {
          type: type,
          body: decoders[type](buffer)
        };
      } catch (err) {
        if (err) return callback(err);
      }
      return callback(null, object, hash);
    }
  }

  function save(object, callback) {
    if (!callback) return save.bind(this, object);
    var buffer, hash;
    try {
      buffer = encoders[object.type](object.body);
      buffer = frame(object.type, buffer);
      hash = sha1(buffer);
    }
    catch (err) {
      return callback(err);
    }
    return db.set(hash, buffer, onSave);

    function onSave(err) {
      if (err) return callback(err);
      return callback(null, hash);
    }
  }

  function loadAs(type, hashish, callback) {
    if (!callback) return loadAs.bind(this, type, hashish);
    return load(hashish, onObject);

    function onObject(err, object, hash) {
      if (object === undefined) return callback(err);
      if (type === "text") {
        type = "blob";
        object.body = parseAscii(object.body, 0, object.body.length);
      }
      if (object.type !== type) {
        return new Error("Expected " + type + ", but found " + object.type);
      }
      return callback(null, object.body, hash);
    }
  }

  function saveAs(type, body, callback) {
    if (!callback) return saveAs.bind(this, type, body);
    if (type === "text") type = "blob";
    return save({ type: type, body: body }, callback);
  }

  function remove(hashish, callback) {
    if (!callback) return remove.bind(this, hashish);
    var hash;
    return resolveHashish(hashish, onHash);

    function onHash(err, result) {
      if (err) return callback(err);
      hash = result;
      return db.del(hash, callback);
    }
  }

  function resolveHashish(hashish, callback) {
    if (!callback) return resolveHashish.bind(this, hashish);
    hashish = hashish.trim();
    if ((/^[0-9a-f]{40}$/i).test(hashish)) {
      return callback(null, hashish.toLowerCase());
    }
    if (hashish === "HEAD") return getHead(onBranch);
    if ((/^refs\//).test(hashish)) {
      return db.get(hashish, checkBranch);
    }
    return checkBranch();

    function onBranch(err, ref) {
      if (err) return callback(err);
      if (!ref) return callback();
      return resolveHashish(ref, callback);
    }

    function checkBranch(err, hash) {
      if (err && err.code !== "ENOENT") return callback(err);
      if (hash) {
        return resolveHashish(hash, callback);
      }
      return db.get("refs/heads/" + hashish, checkTag);
    }

    function checkTag(err, hash) {
      if (err && err.code !== "ENOENT") return callback(err);
      if (hash) {
        return resolveHashish(hash, callback);
      }
      return db.get("refs/tags/" + hashish, final);
    }

    function final(err, hash) {
      if (err) return callback(err);
      if (hash) {
        return resolveHashish(hash, callback);
      }
      err = new Error("ENOENT: Cannot find " + hashish);
      err.code = "ENOENT";
      return callback(err);
    }
  }

  function updateHead(hash, callback) {
    if (!callback) return updateHead.bind(this, hash);
    var ref;
    return getHead(onBranch);

    function onBranch(err, result) {
      if (err) return callback(err);
      if (result === undefined) {
        return setHead("master", function (err) {
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
    return db.set("HEAD", "ref: " + ref + "\n", callback);
  }

  function readRef(ref, callback) {
    if (!callback) return readRef.bind(this, ref);
    return db.get(ref, function (err, result) {
      if (err) return callback(err);
      if (!result) return callback();
      return callback(null, result.trim());
    });
  }

  function createRef(ref, hash, callback) {
    if (!callback) return createRef.bind(this, ref, hash);
    return db.set(ref, hash + "\n", callback);
  }

  function deleteRef(ref, callback) {
    if (!callback) return deleteRef.bind(this, ref);
    return db.del(ref, callback);
  }

  function listRefs(prefix, callback) {
    if (!callback) return listRefs.bind(this, prefix);
    var branches = {}, list = [], target = prefix;
    return db.keys(target, onNames);

    function onNames(err, names) {
      if (err) {
        if (err.code === "ENOENT") return shift();
        return callback(err);
      }
      for (var i = 0, l = names.length; i < l; ++i) {
        list.push(target + "/" + names[i]);
      }
      return shift();
    }

    function shift(err) {
      if (err) return callback(err);
      target = list.shift();
      if (!target) return callback(null, branches);
      return db.get(target, onRead);
    }

    function onRead(err, hash) {
      if (err) {
        if (err.code === "EISDIR") return db.keys(target, onNames);
        return callback(err);
      }
      if (hash) {
        branches[target] = hash.trim();
        return shift();
      }
      return db.keys(target, onNames);
    }
  }

}
