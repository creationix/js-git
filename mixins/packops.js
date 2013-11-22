var bops = require('bops');
var deframe = require('../lib/deframe.js');
var frame = require('../lib/frame.js');
var sha1 = require('../lib/sha1.js');
var inflate = require('../lib/inflate.js');
var deflate = require('../lib/deflate.js');
var applyDelta = require('../lib/apply-delta.js');
var pushToPull = require('push-to-pull');

var typeToNum = {
  commit: 1,
  tree: 2,
  blob: 3,
  tag: 4,
  "ofs-delta": 5,
  "ref-delta": 6
};
var numToType = {};
for (var type in typeToNum) {
  var num = typeToNum[type];
  numToType[num] = type;
}

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
    var hash = hashes[item.offset] = sha1(buffer);
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

function packFrame(type, body, callback) {
  var length = body.length;
  var head = [(typeToNum[type] << 4) | (length & 0xf)];
  var i = 0;
  length >>= 4;
  while (length) {
    head[i++] |= 0x80;
    head[i] = length & 0x7f;
    length >>= 7;
  }
  deflate(body, function (err, body) {
    if (err) return callback(err);
    callback(null, bops.join([bops.from(head), body]));
  });
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
      return callback(null, bops.from(sum, "hex"));
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
    var chunk = bops.create([
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

function decodePack(emit) {

  var state = $pack;
  var sha1sum = sha1();
  var inf = inflate();

  var offset = 0;
  var position = 0;
  var version = 0x4b434150; // PACK reversed
  var num = 0;
  var type = 0;
  var length = 0;
  var ref = null;
  var checksum = "";
  var start = 0;
  var parts = [];


  return function (chunk) {
    if (chunk === undefined) {
      if (num || checksum.length < 40) throw new Error("Unexpected end of input stream");
      return emit();
    }

    for (var i = 0, l = chunk.length; i < l; i++) {
      // console.log([state, i, chunk[i].toString(16)]);
      if (!state) throw new Error("Unexpected extra bytes: " + bops.subarray(chunk, i));
      state = state(chunk[i], i, chunk);
      position++;
    }
    if (!state) return;
    if (state !== $checksum) sha1sum.update(chunk);
    var buff = inf.flush();
    if (buff.length) {
      parts.push(buff);
    }
  };

  // The first four bytes in a packfile are the bytes 'PACK'
  function $pack(byte) {
    if ((version & 0xff) === byte) {
      version >>>= 8;
      return version ? $pack : $version;
    }
    throw new Error("Invalid packfile header");
  }

  // The version is stored as an unsigned 32 integer in network byte order.
  // It must be version 2 or 3.
  function $version(byte) {
    version = (version << 8) | byte;
    if (++offset < 4) return $version;
    if (version >= 2 && version <= 3) {
      offset = 0;
      return $num;
    }
    throw new Error("Invalid version number " + num);
  }

  // The number of objects in this packfile is also stored as an unsigned 32 bit int.
  function $num(byte) {
    num = (num << 8) | byte;
    if (++offset < 4) return $num;
    offset = 0;
    emit({version: version, num: num});
    return $header;
  }

  // n-byte type and length (3-bit type, (n-1)*7+4-bit length)
  // CTTTSSSS
  // C is continue bit, TTT is type, S+ is length
  function $header(byte) {
    if (start === 0) start = position;
    type = byte >> 4 & 0x07;
    length = byte & 0x0f;
    if (byte & 0x80) {
      offset = 4;
      return $header2;
    }
    return afterHeader();
  }

  // Second state in the same header parsing.
  // CSSSSSSS*
  function $header2(byte) {
    length |= (byte & 0x7f) << offset;
    if (byte & 0x80) {
      offset += 7;
      return $header2;
    }
    return afterHeader();
  }

  // Common helper for finishing tiny and normal headers.
  function afterHeader() {
    offset = 0;
    if (type === 6) {
      ref = 0;
      return $ofsDelta;
    }
    if (type === 7) {
      ref = "";
      return $refDelta;
    }
    return $body;
  }

  // Big-endian modified base 128 number encoded ref offset
  function $ofsDelta(byte) {
    ref = byte & 0x7f;
    if (byte & 0x80) return $ofsDelta2;
    return $body;
  }

  function $ofsDelta2(byte) {
    ref = ((ref + 1) << 7) | (byte & 0x7f);
    if (byte & 0x80) return $ofsDelta2;
    return $body;
  }

  // 20 byte raw sha1 hash for ref
  function $refDelta(byte) {
    ref += toHex(byte);
    if (++offset < 20) return $refDelta;
    return $body;
  }

  // Common helper for generating 2-character hex numbers
  function toHex(num) {
    return num < 0x10 ? "0" + num.toString(16) : num.toString(16);
  }

  // Common helper for emitting all three object shapes
  function emitObject() {
    var item = {
      type: numToType[type],
      size: length,
      body: bops.join(parts),
      offset: start
    };
    if (ref) item.ref = ref;
    parts.length = 0;
    start = 0;
    offset = 0;
    type = 0;
    length = 0;
    ref = null;
    emit(item);
  }

  // Feed the deflated code to the inflate engine
  function $body(byte, i, chunk) {
    if (inf.write(byte)) return $body;
    var buf = inf.flush();
    inf.recycle();
    if (buf.length) {
      parts.push(buf);
    }
    emitObject();
    // If this was all the objects, start calculating the sha1sum
    if (--num) return $header;
    sha1sum.update(bops.subarray(chunk, 0, i + 1));
    return $checksum;
  }

  // 20 byte checksum
  function $checksum(byte) {
    checksum += toHex(byte);
    if (++offset < 20) return $checksum;
    var actual = sha1sum.digest();
    if (checksum !== actual) throw new Error("Checksum mismatch: " + actual + " != " + checksum);
  }

}
