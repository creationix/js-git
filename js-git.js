var parseAscii = require('./lib/parseascii.js');
var encoders = require('./lib/encoders.js');
var decoders = require('./lib/decoders.js');
var frame = require('./lib/frame.js');
var deframe = require('./lib/deframe.js');
var sha1 = require('./lib/sha1.js');
var agent = require('./lib/agent.js');
var trace = require('./lib/trace.js');
var applyDelta = require('./lib/apply-delta.js');
var pushToPull = require('push-to-pull');
var parse = pushToPull(require('./lib/decode-pack.js'));

module.exports = newRepo;

function newRepo(db) {
  if (!db) throw new TypeError("A db interface instance is required");

  var repo = {};

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
  repo.walk = walk;         // (seed, scan, compare) -> stream<object>

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

  function logWalk(hashish, callback) {
    if (!callback) return logWalk.bind(this, hashish);
    var last, seen = {};
    return readRef("shallow", onShallow);

    function onShallow(err, shallow) {
      last = shallow;
      return loadAs("commit", hashish, onLoad);
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
      return loadAs("commit", hash, function (err, commit) {
        if (err) return callback(err);
        commit.hash = hash;
        if (hash === last) commit.last = true;
        return callback(null, commit);
      });
    }

    function compare(commit, other) {
      return commit.author.date < other.author.date;
    }
  }

  function treeWalk(hashish, callback) {
    if (!callback) return treeWalk.bind(this, hashish);
    return load(hashish, onLoad);
    function onLoad(err, item, hash) {
      if (err) return callback(err);
      if (item.type === "commit") return load(item.body.tree, onLoad);
      item.hash = hash;
      item.path = "/";
      return callback(null, walk(item, treeScan, treeLoadKey, treeCompare));
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

  function treeLoadKey(entry, callback) {
    return load(entry.hash, function (err, object) {
      if (err) return callback(err);
      entry.type = object.type;
      entry.body = object.body;
      return callback(null, entry);
    });
  }

  function treeCompare(first, second) {
    return first.path < second.path;
  }

  function walk(seed, scan, loadKey, compare) {
    var queue = [seed];
    var working = 0, error, cb;
    return {read: read, abort: abort};

    function read(callback) {
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


  function fetch(remote, opts, callback) {
    if (!callback) return fetch.bind(this, remote, opts);
    var refs, branch, queue, ref, hash;
    return remote.discover(onDiscover);

    function onDiscover(err, serverRefs, serverCaps) {
      if (err) return callback(err);
      refs = serverRefs;
      opts.caps = processCaps(opts, serverCaps);
      return processWants(refs, opts.want, onWants);
    }

    function onWants(err, wants) {
      if (err) return callback(err);
      opts.wants = wants;
      return remote.fetch(repo, opts, onPackStream);
    }

    function onPackStream(err, raw) {
      if (err) return callback(err);
      if (!raw) return remote.close(onDone);
      var packStream = parse(raw);
      return unpack(packStream, opts, onUnpack);
    }

    function onUnpack(err) {
      if (err) return callback(err);
      return remote.close(onClose);
    }

    function onClose(err) {
      if (err) return callback(err);
      queue = Object.keys(refs);
      return next();
    }

    function next(err) {
      if (err) return callback(err);
      ref = queue.shift();
      if (!ref) return setHead(branch, onDone);
      if (ref === "HEAD" || /{}$/.test(ref)) return next();
      hash = refs[ref];
      if (!branch && (hash === refs.HEAD)) branch = ref.substr(11);
      db.has(hash, onHas);
    }

    function onHas(err, has) {
      if (err) return callback(err);
      if (!has) return next();
      return db.set(ref, hash + "\n", next);
    }

    function onDone(err) {
      if (err) return callback(err);
      return callback(null, refs);
    }
  }

  function processCaps(opts, serverCaps) {
    var caps = [];
    if (serverCaps["ofs-delta"]) caps.push("ofs-delta");
    if (serverCaps["thin-pack"]) caps.push("thin-pack");
    if (opts.includeTag && serverCaps["include-tag"]) caps.push("include-tag");
    if ((opts.onProgress || opts.onError) &&
        (serverCaps["side-band-64k"] || serverCaps["side-band"])) {
      caps.push(serverCaps["side-band-64k"] ? "side-band-64k" : "side-band");
      if (!opts.onProgress && serverCaps["no-progress"]) {
        caps.push("no-progress");
      }
    }
    if (serverCaps.agent) caps.push("agent=" + agent);
    return caps;
  }

  function processWants(refs, filter, callback) {
    if (filter === null || filter === undefined) {
      return defaultWants(refs, callback);
    }
    filter = Array.isArray(filter) ? arrayFilter(filter) :
      typeof filter === "function" ? filter = filter :
      wantFilter(filter);

    var list = Object.keys(refs);
    var wants = {};
    var ref, hash;
    return shift();
    function shift() {
      ref = list.shift();
      if (!ref) return callback(null, Object.keys(wants));
      hash = refs[ref];
      resolveHashish(ref, onResolve);
    }
    function onResolve(err, oldHash) {
      // Skip refs we already have
      if (hash === oldHash) return shift();
      filter(ref, onFilter);
    }
    function onFilter(err, want) {
      if (err) return callback(err);
      // Skip refs the user doesn't want
      if (want) wants[hash] = true;
      return shift();
    }
  }

  function defaultWants(refs, callback) {
    return listRefs("refs/heads", onRefs);

    function onRefs(err, branches) {
      if (err) return callback(err);
      var wants = Object.keys(branches);
      wants.unshift("HEAD");
      return processWants(refs, wants, callback);
    }
  }

  function wantMatch(ref, want) {
    if (want === "HEAD" || want === null || want === undefined) {
      return ref === "HEAD";
    }
    if (Object.prototype.toString.call(want) === '[object RegExp]') {
      return want.test(ref);
    }
    if (typeof want === "boolean") return want;
    if (typeof want !== "string") {
      throw new TypeError("Invalid want type: " + typeof want);
    }
    return (/^refs\//.test(ref) && ref === want) ||
      (ref === "refs/heads/" + want) ||
      (ref === "refs/tags/" + want);
  }

  function wantFilter(want) {
    return filter;
    function filter(ref, callback) {
      var result;
      try {
        result = wantMatch(ref, want);
      }
      catch (err) {
        return callback(err);
      }
      return callback(null, result);
    }
  }

  function arrayFilter(want) {
    var length = want.length;
    return filter;
    function filter(ref, callback) {
      var result;
      try {
        for (var i = 0; i < length; ++i) {
          if (result = wantMatch(ref, want[i])) break;
        }
      }
      catch (err) {
        return callback(err);
      }
      return callback(null, result);
    }
  }

  function push() {
    throw new Error("TODO: Implement repo.push");
  }

  function unpack(packStream, opts, callback) {
    if (!callback) return unpack.bind(this, packStream, opts);

    var version, num, numDeltas = 0, count = 0, countDeltas = 0;
    var done, startDeltaProgress = false;

    // hashes keyed by offset for ofs-delta resolving
    var hashes = {};
    var has = {};

    return packStream.read(onStats);

    function onDone(err) {
      if (done) return;
      done = true;
      return callback(err);
    }

    function onStats(err, stats) {
      if (err) return onDone(err);
      version = stats.version;
      num = stats.num;
      packStream.read(onRead);
    }

    function objectProgress(more) {
      if (!more) startDeltaProgress = true;
      var percent = Math.round(count / num * 100);
      return opts.onProgress("Receiving objects: " + percent + "% (" + (count++) + "/" + num + ")   " + (more ? "\r" : "\n"));
    }

    function deltaProgress(more) {
      if (!startDeltaProgress) return;
      var percent = Math.round(countDeltas / numDeltas * 100);
      return opts.onProgress("Applying deltas: " + percent + "% (" + (countDeltas++) + "/" + numDeltas + ")   " + (more ? "\r" : "\n"));
    }

    function onRead(err, item) {
      if (err) return onDone(err);
      if (opts.onProgress) objectProgress(item);
      if (item === undefined) return resolveDeltas();
      if (item.size !== item.body.length) {
        return onDone(new Error("Body size mismatch"));
      }
      if (item.type === "ofs-delta") {
        numDeltas++;
        item.ref = hashes[item.offset - item.ref];
        return resolveDelta(item);
      }
      if (item.type === "ref-delta") {
        numDeltas++;
        return checkDelta(item);
      }
      return saveValue(item);
    }

    function resolveDelta(item) {
      if (opts.onProgress) deltaProgress();
      return db.get(item.ref, function (err, buffer) {
        if (err) return onDone(err);
        var target = deframe(buffer);
        item.type = target[0];
        item.body = applyDelta(item.body, target[1]);
        return saveValue(item);
      });
    }

    function checkDelta(item) {
      var hasTarget = has[item.ref];
      if (hasTarget === true) return resolveDelta(item);
      if (hasTarget === false) return enqueueDelta(item);
      return db.has(item.ref, function (err, value) {
        if (err) return onDone(err);
        has[item.ref] = value;
        if (value) return resolveDelta(item);
        return enqueueDelta(item);
      });
    }

    function saveValue(item) {
      var buffer = frame(item.type, item.body);
      var hash = hashes[item.offset] = sha1(buffer);
      has[hash] = true;
      return db.set(hash, buffer, onSave);
    }

    function onSave(err) {
      if (err) return callback(err);
      packStream.read(onRead);
    }

    function enqueueDelta(item) {
      // I have yet to come across a repo that actually needs this path.
      // It's hard to implement without something to test against.
      throw "TODO: enqueueDelta";
    }

    function resolveDeltas() {
      // TODO: resolve any pending deltas once enqueueDelta is implemented.
      return onDone();
    }

  }
}

function assertType(object, type) {
  if (object.type !== type) {
    throw new Error(type + " expected, but found " + object.type);
  }
}
