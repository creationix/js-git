module.exports = newRepo;

// platform options are: db, proto, and trace
function newRepo(conf, platform) {
  var trace = platform.trace;
  var sha1 = platform.sha1;
  var bops = platform.bops;
  var db = conf.db;
  var fs = conf.fs;
  var index = conf.index;
  var proto = conf.proto;

  var encoders = {
    commit: encodeCommit,
    tag: encodeTag,
    tree: encodeTree,
    blob: encodeBlob
  };

  var decoders = {
    commit: decodeCommit,
    tag: decodeTag,
    tree: decodeTree,
    blob: decodeBlob
  };

  var repo = {};

  if (db) {
    // Git Objects
    repo.load = load;       // (hashish) -> object
    repo.save = save;       // (object) -> hash
    repo.loadAs = loadAs;   // (type, hashish) -> value
    repo.saveAs = saveAs;   // (type, value) -> hash
    repo.remove = remove;   // (hashish)

    // Refs
    repo.resolveHashish = resolveHashish; // (hashish) -> hash
    repo.updateHead = updateHead;         // (hash)
    repo.getBranch = getBranch;           // () -> branchName
    repo.setBranch = setBranch;           // (branchName)
    repo.createBranch = createBranch;     // (branchName, hash)
    repo.deleteBranch = deleteBranch;     // (branchName)
    repo.listBranches = listBranches;     // () -> branchNames
    repo.createTag = createTag;           // (tagName, hash)
    repo.deleteTag = deleteTag;           // (tagName)
    repo.listTags = listTags;             // () -> tagNames

    if (fs && index) {
      // TODO: design API for working directories and staging areas.
    }
  }

  // Network Protocols
  if (proto) {
    repo.lsRemote = proto.lsRemote;
    if (db) {
      repo.fetch = fetch;
      repo.push = push;
    }
  }

  return repo;

  function load(hashish, callback) {
    if (!callback) return load.bind(this, hashish);
    return resolveHashish(hashish, function (err, hash) {
      if (err) return callback(err);
      return db.load(hash, function (err, buffer) {
        if (err) return callback(err);
        var checkHash, type, object;
        try {
          var pair = deframe(buffer);
          type = pair[0];
          buffer = pair[1];
          checkHash = sha1(buffer);
          object = {
            type: type,
            body: decoders[type](buffer)
          };
        } catch (err) {
          if (err) return callback(err);
        }
        if (checkHash !== hash) {
          return callback(new Error("Hash checksum failed for " + hash));
        }
        if (trace) trace("load", hash);
        return callback(null, object);
      });
    });
  }

  function save(object, callback) {
    if (!callback) return save.bind(this, object);
    var buffer, hash;
    try {
      buffer = encoders[object.type](object.body);
      hash = sha1(buffer);
      buffer = frame(object.type, buffer);
    }
    catch (err) {
      return callback(err);
    }
    return db.save(hash, buffer, function (err) {
      if (err) return callback(err);
      if (trace) trace("save", hash);
      return callback(null, hash);
    });
  }

  function loadAs(type, hashish, callback) {
    if (!callback) return loadAs.bind(this, type, hashish);
    return load(hashish, function (err, object) {
      if (err) return callback(err);
      if (object.type !== type) {
        return new Error("Expected " + type + ", but found " + object.type);
      }
      return callback(null, object.body);
    });
  }

  function saveAs(type, body, callback) {
    if (!callback) return saveAs.bind(this, type, body);
    return save({ type: type, body: body }, callback);
  }

  function remove(hashish, callback) {
    if (!callback) return remove.bind(this, hashish);
    return resolveHashish(hashish, function (err, hash) {
      if (err) return callback(err);
      return db.remove(hash, function (err) {
        if (err) return callback(err);
        if (trace) trace("remove", hash);
        return callback();
      });
    });
  }

  function resolveHashish(hashish, callback) {
    if (!callback) return resolveHashish.bind(this, hashish);
    hashish = hashish.trim();
    if ((/^[0-9a-f]{40}$/i).test(hashish)) {
      return callback(null, hashish.toLowerCase());
    }
    if (hashish === "HEAD") {
      return getBranch(function (err, ref) {
        if (err) return callback(err);
        return resolveHashish(ref, callback);
      });
    }
    if ((/^refs\//).test(hashish)) {
      return db.read(hashish, checkBranch);
    }
    return checkBranch();
    function checkBranch(err, hash) {
      if (err) return callback(err);
      if (hash) return resolveHashish(hash, callback);
      return db.read("refs/heads/" + hashish, checkTag);
    }
    function checkTag(err, hash) {
      if (err) return callback(err);
      if (hash) return resolveHashish(hash, callback);
      return db.read("refs/tags/" + hashish, final);
    }
    function final(err, hash) {
      if (err) return callback(err);
      if (hash) return resolveHashish(hash, callback);
      return callback(new Error("Cannot find hashish: " + hashish));
    }
  }

  function updateHead(hash, callback) {
    if (!callback) return updateHead.bind(this, hash);
    return getBranch(function (err, ref) {
      if (err) return callback(err);
      return db.write(ref, hash, callback);
    });
  }

  function getBranch(callback) {
    if (!callback) return getBranch.bind(this);
    return db.read("HEAD", function (err, ref) {
      if (err) return callback(err);
      if (!ref) return callback(new Error("Missing HEAD"));
      var match = ref.match(/^ref: *(.*)/);
      if (!match) return callback(new Error("Invalid HEAD"));
      return callback(null, match[1]);
    });
  }

  function setBranch(branchName, callback) {
    if (!callback) return setBranch.bind(this, branchName);
    return db.write("HEAD", "ref: refs/heads/" + branchName + "\n", callback);
  }

  function createBranch(branchName, hash, callback) {
    if (!callback) return createBranch.bind(this, branchName, hash);
    return createThing("refs/heads/", branchName, hash, callback);
  }

  function createTag(tagName, hash, callback) {
    if (!callback) return createTag.bind(this, tagName, hash);
    return createThing("refs/tags/", tagName, hash, callback);
  }

  function createThing(prefix, name, hash, callback) {
    return db.write(prefix + name, hash + "\n", callback);
  }

  function deleteBranch(branchName, callback) {
    if (!callback) return deleteBranch.bind(this, branchName);
    return deleteThing("refs/heads/", branchName, callback);
  }

  function deleteTag(tagName, callback) {
    if (!callback) return deleteTag.bind(this, tagName);
    return deleteThing("refs/tags/", tagName, callback);
  }

  function deleteThing(prefix, name, callback) {
    return db.unlink(prefix + name, callback);
  }

  function listBranches(callback) {
    if (!callback) return listBranches.bind(this);
    return listThings("refs/heads/", callback);
  }

  function listTags(callback) {
    if (!callback) return listTags.bind(this);
    return listThings("refs/tags/", callback);
  }

  function listThings(prefix, callback) {
    var branches = {};
    return loadDir(prefix, function (err) {
      if (err) return callback(err);
      callback(null, branches);
    });

    function loadDir(dir, callback) {
      var list;
      return db.readdir(dir, function (err, names) {
        if (err) return callback(err);
        list = new Array(names.length);
        for (var i = 0, l = names.length; i < l; ++i) {
          list[i] = dir + "/" + names[i];
        }
        return shift();
      });
      function shift(err) {
        if (err) return callback(err);
        var target = list.shift();
        if (!target) return callback();
        return db.read(target, function (err, hash) {
          if (err) return callback(err);
          if (hash) {
            branches[target.substr(11)] = hash.trim();
            return shift();
          }
          return loadDir(target, shift);
        });
      }
    }
  }


  function fetch() {
    throw new Error("TODO: Implement repo.fetch");
  }

  function push() {
    throw new Error("TODO: Implement repo.fetch");
  }

  function deframe(buffer) {
    throw new Error("TODO: Implement frame");
  }

  function frame(type, buffer) {
    throw new Error("TODO: Implement deframe");

  }

  function encodeCommit(commit) {
    throw new Error("TODO: Implement encodeCommit");
  }

  function encodeTag(tag) {
    throw new Error("TODO: Implement encodeTag");
  }

  function encodeTree(tree) {
    throw new Error("TODO: Implement encodeTree");
  }

  function encodeBlob(blob) {
    throw new Error("TODO: Implement encodeBlob");
  }

  function decodeCommit(buffer) {
    throw new Error("TODO: Implement decodeCommit");
  }

  function decodeTag(buffer) {
    throw new Error("TODO: Implement decodeTag");
  }

  function decodeTree(buffer) {
    throw new Error("TODO: Implement decodeTree");
  }

  function decodeBlob(buffer) {
    return buffer;
  }

}

