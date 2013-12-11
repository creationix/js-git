// Simple helper for parallel work.
function makeGroup(callback) {
  var done = false;
  var left = 0;
  var results = {};
  return function (name) {
    left++;
    return function (err, result) {
      if (done) return;
      if (err) {
        done = true;
        return callback(err);
      }
      results[name] = result;
      if (--left) return;
      done = true;
      return callback(null, results);
    };
  };
}

var bops = {
  join: require('bops/join.js')
};

module.exports = function (repo) {
  repo.uploadPack = uploadPack;
  repo.receivePack = receivePack;
};

function uploadPack(remote, opts, callback) {
  if (!callback) return uploadPack.bind(this, remote, opts);
  var repo = this, refs, wants = {}, haves = {}, clientCaps = {};
  var head;
  var packQueue = [];
  var queueBytes = 0;
  var queueLimit = 0;
  repo.listRefs(null, onRefs);

  function onRefs(err, result) {
    if (err) return callback(err);
    refs = result;
    repo.getHead(onHead);
  }

  function onHead(err, result) {
    if (err) return callback(err);
    head = result;

    // The peeled value of a ref (that is "ref^{}") MUST be immediately after
    // the ref itself, if presented. A conforming server MUST peel the ref if
    // it’s an annotated tag.
    var gen = makeGroup(onValues);
    for (var ref in refs) {
      repo.load(refs[ref], gen(ref));
    }
  }

  function onValues(err, values) {
    if (err) return callback(err);
    // Insert peeled refs.
    for (var ref in values) {
      var value = values[ref];
      if (value.type === "tag") {
        refs[ref+"^{}"] = value.body.object;
      }
    }

    // The returned response is a pkt-line stream describing each ref and its
    // current value. The stream MUST be sorted by name according to the C
    // locale ordering.
    var keys = Object.keys(refs).sort();
    var lines = keys.map(function (ref) {
      return refs[ref] + " " + ref;
    });

    // If HEAD is a valid ref, HEAD MUST appear as the first advertised ref.
    // If HEAD is not a valid ref, HEAD MUST NOT appear in the advertisement
    // list at all, but other refs may still appear.
    if (head) lines.unshift(refs[head] + " HEAD");

    // The stream MUST include capability declarations behind a NUL on the
    // first ref.
    // TODO: add "multi_ack" once it's implemented
    // TODO: add "multi_ack_detailed" once it's implemented
    // TODO: add "shallow" once it's implemented
    // TODO: add "include-tag" once it's implemented
    // TODO: add "thin-pack" once it's implemented
    lines[0] += "\0no-progress side-band side-band-64k ofs-delta";

    // Server SHOULD terminate each non-flush line using LF ("\n") terminator;
    // client MUST NOT complain if there is no terminator.
    lines.forEach(function (line) {
      remote.write(line, null);
    });

    remote.write(null, null);
    remote.read(onWant);
  }

  function onWant(err, line) {
    if (line === undefined) return callback(err);
    if (line === null) {
      return remote.read(onHave);
    }
    var match = line.match(/^want ([0-9a-f]{40})(?: (.+))?\n?$/);
    if (!match) {
      return callback(new Error("Invalid want: " + line));
    }
    var hash = match[1];
    if (match[2]) clientCaps = parseCaps(match[2]);
    wants[hash] = true;
    remote.read(onWant);
  }

  function onHave(err, line) {
    if (line === undefined) return callback(err);
    var match = line.match(/^(done|have)(?: ([0-9a-f]{40}))?\n?$/);
    if (!match) {
      return callback(new Error("Unexpected have line: " + line));
    }
    if (match[1] === "have") {
      haves[match[2]] = true;
      return remote.read(onHave);
    }
    if (Object.keys(haves).length) {
      throw new Error("TODO: handle haves");
    }
    remote.write("NAK\n", null);
    walkRepo(repo, wants, haves, onHashes);
  }

  function onHashes(err, hashes) {
    if (err) return callback(err);
    if (clientCaps["side-band-64k"]) queueLimit = 65519;
    else if (clientCaps["size-band"]) queueLimit = 999;
    repo.pack(hashes, opts, onPack);
  }

  function flush(callback) {
    if (!queueBytes) return callback();
    var chunk = bops.join(packQueue, queueBytes);
    packQueue.length = 0;
    queueBytes = 0;
    remote.write(["pack", chunk], callback);
  }

  function onPack(err, packStream) {
    if (err) return callback(err);
    onWrite();

    function onRead(err, chunk) {
      if (err) return callback(err);
      if (chunk === undefined) return flush(onFlush);
      if (!queueLimit) {
        return remote.write(chunk, onWrite);
      }
      var length = chunk.length;
      if (queueBytes + length <= queueLimit) {
        packQueue.push(chunk);
        queueBytes += length;
        return onWrite();
      }
      if (queueBytes) {
        flush(function (err) {
          if (err) return callback(err);
          return onRead(null, chunk);
        });
      }
      remote.write(["pack", bops.subarray(chunk, 0, queueLimit)], function (err) {
        if (err) return callback(err);
        return onRead(null, bops.subarray(chunk, queueLimit));
      });
    }
    function onWrite(err) {
      if (err) return callback(err);
      packStream.read(onRead);
    }
  }

  function onFlush(err) {
    if (err) return callback(err);
    if (queueLimit) remote.write(null, callback);
    else callback();
  }

}

function receivePack(remote, opts, callback) {
  if (!callback) return receivePack.bind(this, remote, opts);
  var clientCaps = {}, changes = [];
  var repo = this;
  this.listRefs(null, function (err, refs) {
    if (err) return callback(err);
    Object.keys(refs).forEach(function (ref, i) {
      var hash = refs[ref];
      var line = hash + " " + ref;
      // TODO: Implement report-status below and add here
      if (!i) line += "\0delete-refs ofs-delta";
      remote.write(line, null);
    });
    remote.write(null, null);
    remote.read(onLine);
  });

  function onLine(err, line) {
    if (err) return callback(err);
    if (line === null) {
      if (changes.length) return repo.unpack(remote, opts, onUnpack);
      return callback(null, changes);
    }
    var match = line.match(/^([0-9a-f]{40}) ([0-9a-f]{40}) ([^ ]+)(?: (.+))?\n?$/);
    changes.push({
      oldHash: match[1],
      newHash: match[2],
      ref: match[3]
    });
    if (match[4]) clientCaps = parseCaps(match[4]);
    remote.read(onLine);
  }

  function onUnpack(err) {
    if (err) return callback(err);
    var i = 0, change;
    next();
    function next(err) {
      if (err) return callback(err);
      change = changes[i++];
      if (!change) return callback(err, changes);
      if (change.oldHash === "0000000000000000000000000000000000000000") {
        return repo.createRef(change.ref, change.newHash, next);
      }
      if (change.newHash === "0000000000000000000000000000000000000000") {
        return repo.deleteRef(change.ref, next);
      }
      return repo.updateRef(change.ref, change.newHash, next);
    }
  }
}

function parseCaps(line) {
  var caps = {};
  line.split(" ").map(function (cap) {
    var pair = cap.split("=");
    caps[pair[0]] = pair[1] || true;
  });
  return caps;
}

// Calculate a list of hashes to be included in a pack file based on have and want lists.
//
function walkRepo(repo, wants, haves, callback) {
  var hashes = {};
  var done = false;
  var left = 0;

  function onDone(err) {
    if (done) return;
    done = true;
    return callback(err, Object.keys(hashes));
  }

  var keys = Object.keys(wants);
  if (!keys.length) return onDone();
  keys.forEach(walkCommit);

  function walkCommit(hash) {
    if (done) return;
    if (hash in hashes || hash in haves) return;
    hashes[hash] = true;
    left++;
    repo.loadAs("commit", hash, function (err, commit) {
      if (done) return;
      if (err) return onDone(err);
      if (!commit) return onDone(new Error("Missing Commit: " + hash));
      commit.parents.forEach(walkCommit);
      walkTree(commit.tree);
      if (!--left) return onDone();
    });
  }

  function walkTree(hash) {
    if (done) return;
    if (hash in hashes || hash in haves) return;
    hashes[hash] = true;
    left++;
    repo.loadAs("tree", hash, function (err, tree) {
      if (done) return;
      if (err) return onDone(err);
      if (tree === undefined) return onDone(new Error("Missing tree: " + hash));
      Object.keys(tree).forEach(function (name) {
        if (done) return;
        var item = tree[name];
        if (item.mode === 040000) walkTree(item.hash);
        else {
          if (item.hash in hashes || item.hash in haves) return;
          hashes[item.hash] = true;
        }
      });
      if (!--left) return onDone();
    });
  }
}
