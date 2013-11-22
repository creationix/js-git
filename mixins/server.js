module.exports = function (repo) {
  repo.uploadPack = uploadPack;
  repo.receivePack = receivePack;
};

function uploadPack(remote, opts, callback) {
  if (!callback) return uploadPack.bind(this, remote, opts);
  throw "TODO: Implement repo.uploadPack";
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
    var match = line.match(/^([0-9a-f]{40}) ([0-9a-f]{40}) ([^ ]+)(?: (.+))?$/);
    changes.push({
      oldHash: match[1],
      newHash: match[2],
      ref: match[3]
    });
    if (match[4]) {
      match[4].split(" ").map(function (cap) {
        var pair = cap.split("=");
        clientCaps[pair[0]] = pair[1] || true;
      });
    }
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