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
  var clientCaps = null, changes = [];
  var repo = this;
  this.listRefs(null, function (err, refs) {
    if (err) return callback(err);
    Object.keys(refs).forEach(function (ref, i) {
      var hash = refs[ref];
      var line = hash + " " + ref;
      if (!i) line += " report-status delete-refs";
      remote.write(line, null);
    });
    remote.write(null, null);
    remote.read(onLine);
  });

  function onLine(err, line) {
    if (err) return callback(err);
    if (line === null) {
      return repo.unpack(remote, opts, onUnpack);
    }
    var match = line.match(/^([0-9a-f]{40}) ([0-9a-f]{40}) (.+?)(?: (.+))?$/);
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

  function onUnpack(err, out) {
    if (err) return callback(err);
    console.log({
      caps: clientCaps,
      changes: changes,
      out: out
    });
  }


}