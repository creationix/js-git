var deframe = require('./deframe.js');
var frame = require('./frame.js');
var sha1 = require('./sha1.js');
var applyDelta = require('./apply-delta.js');
module.exports = unpack;

function unpack(packStream, opts, callback) {
  if (!callback) return unpack.bind(this, packStream, opts);
  var repo = this;
  var db = repo.db;

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
