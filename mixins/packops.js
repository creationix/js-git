var binary = require('bodec');
var deframe = require('../lib/deframe.js');
var frame = require('../lib/frame.js');
var sha1 = require('git-sha1');
var applyDelta = require('../lib/apply-delta.js');
var pushToPull = require('push-to-pull');
var decodePack = require('../lib/pack-codec.js').decodePack;
var packFrame = require('../lib/pack-codec.js').packFrame;

module.exports = function (repo) {
  // packStream is a simple-stream containing raw packfile binary data
  // opts can contain "onProgress" or "onError" hook functions.
  // callback will be called with a list of all unpacked hashes on success.
  repo.unpack = unpack; // (packStream, opts) -> hashes

  // hashes is an array of hashes to pack
  // callback will be a simple-stream containing raw packfile binary data
  repo.pack = pack;     // (hashes, opts) -> packStream

};

function unpack(packStream, opts, callback) {
  if (!callback) return unpack.bind(this, packStream, opts);

  packStream = pushToPull(decodePack)(packStream);

  var repo = this;

  var version, num, numDeltas = 0, count = 0, countDeltas = 0;
  var done, startDeltaProgress = false;

  // hashes keyed by offset for ofs-delta resolving
  var hashes = {};
  // key is hash, boolean is cached "has" value of true or false
  var has = {};
  // key is hash we're waiting for, value is array of items that are waiting.
  var pending = {};

  return packStream.read(onStats);

  function onDone(err) {
    if (done) return;
    done = true;
    if (err) return callback(err);
    return callback(null, values(hashes));
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
    if (item === undefined) return onDone();
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
    return repo.loadRaw(item.ref, function (err, buffer) {
      if (err) return onDone(err);
      if (!buffer) return onDone(new Error("Missing base image at " + item.ref));
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
    return repo.has(item.ref, function (err, value) {
      if (err) return onDone(err);
      has[item.ref] = value;
      if (value) return resolveDelta(item);
      return enqueueDelta(item);
    });
  }

  function saveValue(item) {
    var buffer = frame(item.type, item.body);
    var hash = sha1(buffer);
    hashes[item.offset] = hash;
    has[hash] = true;
    if (hash in pending) {
      // I have yet to come across a pack stream that actually needs this.
      // So I will only implement it when I have concrete data to test against.
      console.error({
        list: pending[hash],
        item: item
      });
      throw "TODO: pending value was found, resolve it";
    }
    return repo.saveRaw(hash, buffer, onSave);
  }

  function onSave(err) {
    if (err) return callback(err);
    packStream.read(onRead);
  }

  function enqueueDelta(item) {
    var list = pending[item.ref];
    if (!list) pending[item.ref] = [item];
    else list.push(item);
    packStream.read(onRead);
  }

}

// TODO: Implement delta refs to reduce stream size
function pack(hashes, opts, callback) {
  if (!callback) return pack.bind(this, hashes, opts);
  var repo = this;
  var sha1sum = sha1();
  var i = 0, first = true, done = false;
  return callback(null, { read: read, abort: callback });

  function read(callback) {
    if (done) return callback();
    if (first) return readFirst(callback);
    var hash = hashes[i++];
    if (hash === undefined) {
      var sum = sha1sum.digest();
      done = true;
      return callback(null, binary.fromHex(sum));
    }
    repo.loadRaw(hash, function (err, buffer) {
      if (err) return callback(err);
      if (!buffer) return callback(new Error("Missing hash: " + hash));
      // Reframe with pack format header
      var pair = deframe(buffer);
      packFrame(pair[0], pair[1], function (err, buffer) {
        if (err) return callback(err);
        sha1sum.update(buffer);
        callback(null, buffer);
      });
    });
  }

  function readFirst(callback) {
    var length = hashes.length;
    var chunk = binary.fromArray([
      0x50, 0x41, 0x43, 0x4b, // PACK
      0, 0, 0, 2,             // version 2
      length >> 24,           // Num of objects
      (length >> 16) & 0xff,
      (length >> 8) & 0xff,
      length & 0xff
    ]);
    first = false;
    sha1sum.update(chunk);
    callback(null, chunk);
  }
}

function values(object) {
  var keys = Object.keys(object);
  var length = keys.length;
  var out = new Array(length);
  for (var i = 0; i < length; i++) {
    out[i] = object[keys[i]];
  }
  return out;
}
