var pushToPull = require('push-to-pull');
var parse = pushToPull(require('../lib/pack-codec.js').decodePack);
var agent = require('../lib/agent.js');

module.exports = function (repo) {
  repo.fetchPack = fetchPack;
  repo.sendPack = sendPack;
};

function fetchPack(remote, opts, callback) {
  if (!callback) return fetchPack.bind(this, remote, opts);
  var repo = this;
  var db = repo.db;
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
    return repo.unpack(packStream, opts, onUnpack);
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
    if (!ref) return repo.setHead(branch, onDone);
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
      repo.resolve(ref, onResolve);
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
    return repo.listRefs("refs/heads", onRefs);

    function onRefs(err, branches) {
      if (err) return callback(err);
      var wants = Object.keys(branches);
      wants.unshift("HEAD");
      return processWants(refs, wants, callback);
    }
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
        result = wantMatch(ref, want[i]);
        if (result) break;
      }
    }
    catch (err) {
      return callback(err);
    }
    return callback(null, result);
  }
}

function sendPack(remote, opts, callback) {
  if (!callback) return sendPack.bind(this, remote, opts);
  throw "TODO: Implement repo.sendPack";
}
