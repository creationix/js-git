"use strict";
var bodec = require('bodec');
var inflate = require('../lib/inflate');
var deflate = require('../lib/deflate');
var codec = require('../lib/object-codec');
var parsePackEntry = require('../lib/pack-codec').parseEntry;
var applyDelta = require('../lib/apply-delta');
var sha1 = require('git-sha1');
var pathJoin = require('pathjoin');

// The fs object has the following interface:
// - readFile(path) => binary
// - readChunk(path, start, end) => binary
// - writeFile(path, binary) =>
//   Must also make every directory up to parent of path.
// - readDir(path) => array<paths>
// The repo is expected to have a rootPath property that points to
// the .git folder within the filesystem.
module.exports = function (repo, fs) {

  var cachedIndexes = {};

  repo.loadAs = loadAs;
  repo.saveAs = saveAs;
  repo.loadRaw = loadRaw;
  repo.saveRaw = saveRaw;
  repo.readRef = readRef;
  repo.updateRef = updateRef;

  function updateRef(ref, hash, callback) {
    if (!callback) return updateRef.bind(repo, ref, hash);
    var path = pathJoin(repo.rootPath, ref);
    fs.writeFile(path, bodec.fromRaw(hash + "\n"), callback);
  }

  function readRef(ref, callback) {
    if (!callback) return readRef.bind(repo, ref);
    var path = pathJoin(repo.rootPath, ref);
    fs.readFile(path, function (err, binary) {
      if (err) return callback(err);
      if (binary === undefined) {
        return readPackedRef(ref, callback);
      }
      var hash;
      try { hash = bodec.toRaw(binary).trim(); }
      catch (err) { return callback(err); }
      callback(null, hash);
    });
  }

  function readPackedRef(ref, callback) {
    var path = pathJoin(repo.rootPath, "packed-refs");
    fs.readFile(path, function (err, binary) {
      if (binary === undefined) return callback(err);
      var hash;
      try {
        var text = bodec.toRaw(binary);
        var index = text.indexOf(ref);
        if (index >= 0) {
          hash = text.substring(index - 41, index - 1);
        }
      }
      catch (err) {
        return callback(err);
      }
      callback(null, hash);
    });
  }

  function saveAs(type, body, callback) {
    if (!callback) return saveAs.bind(repo, type, body);
    var raw, hash;
    try {
      raw = codec.frame({
        type: type,
        body: codec.encoders[type](body)
      });
      hash = sha1(raw);
    }
    catch (err) { return callback(err); }
    saveRaw(hash, raw, function (err) {
      if (err) return callback(err);
      callback(null, hash);
    });
  }

  function saveRaw(hash, raw, callback) {
    if (!callback) return saveRaw.bind(repo, hash, raw);
    var buffer, path;
    try {
      if (sha1(raw) !== hash) {
        throw new Error("Save data does not match hash");
      }
      buffer = deflate(raw);
      path = hashToPath(hash);
    }
    catch (err) { return callback(err); }
    fs.writeFile(path, buffer, callback);
  }

  function loadAs(type, hash, callback) {
    if (!callback) return loadAs.bind(repo, type, hash);
    loadRaw(hash, function (err, raw) {
      if (raw === undefined) return callback(err);
      var body;
      try {
        raw = codec.deframe(raw);
        if (raw.type !== type) throw new TypeError("Type mismatch");
        body = codec.decoders[raw.type](raw.body);
      }
      catch (err) { return callback(err); }
      callback(null, body);
    });
  }

  function loadRaw(hash, callback) {
    if (!callback) return loadRaw.bind(repo, hash);
    var path = hashToPath(hash);
    fs.readFile(path, function (err, buffer) {
      if (err) return callback(err);
      if (buffer) {
        var raw;
        try { raw = inflate(buffer); }
        catch (err) { return callback(err); }
        return callback(null, raw);
      }
      return loadRawPacked(hash, callback);
    });
  }

  function loadRawPacked(hash, callback) {
    var packDir = pathJoin(repo.rootPath, "objects/pack");
    var packHashes = [];
    fs.readDir(packDir, function (err, entries) {
      if (!entries) return callback(err);
      entries.forEach(function (name) {
        var match = name.match(/pack-([0-9a-f]{40}).idx/);
        if (match) packHashes.push(match[1]);
      });
      start();
    });

    function start() {
      var packHash = packHashes.pop();
      var offsets;
      if (!packHash) return callback();
      if (!cachedIndexes[packHash]) loadIndex(packHash);
      else onIndex();

      function loadIndex() {
        var indexFile = pathJoin(packDir, "pack-" + packHash + ".idx" );
        fs.readFile(indexFile, function (err, buffer) {
          if (!buffer) return callback(err);
          try {
            cachedIndexes[packHash] = parseIndex(buffer);
          }
          catch (err) { return callback(err); }
          onIndex();
        });
      }

      function onIndex() {
        var cached = cachedIndexes[packHash];
        var packFile = pathJoin(packDir, "pack-" + packHash + ".pack" );
        var index = cached.byHash[hash];
        if (!index) return start();
        offsets = cached.offsets;
        loadChunk(packFile, index.offset, callback);
      }

      function loadChunk(packFile, start, callback) {
        var index = offsets.indexOf(start);
        var end = index >= 0 ? offsets[index + 1] : -20;
        fs.readChunk(packFile, start, end, function (err, chunk) {
          if (!chunk) return callback(err);
          var raw;
          try {
            var entry = parsePackEntry(chunk);
            if (entry.type === "ref-delta") {
              return loadRaw.call(repo, hash, onBase);
            }
            else if (entry.type === "ofs-delta") {
              return loadChunk(packFile, start - entry.ref, onBase);
            }
            raw = codec.frame(entry);
          }
          catch (err) { return callback(err); }
          callback(null, raw);

          function onBase(err, base) {
            if (!base) return callback(err);
            var object = codec.deframe(base);
            var buffer;
            try {
              object.body = applyDelta(entry.body, object.body);
              buffer = codec.frame(object);
            }
            catch (err) { return callback(err); }
            callback(null, buffer);
          }
        });
      }

    }
  }

  function hashToPath(hash) {
    return pathJoin(repo.rootPath, "objects", hash.substring(0, 2), hash.substring(2));
  }

};

function parseIndex(buffer) {
  if (readUint32(buffer, 0) !== 0xff744f63 ||
      readUint32(buffer, 4) !== 0x00000002) {
    throw new Error("Only v2 pack indexes supported");
  }

  // Get the number of hashes in index
  // This is the value of the last fan-out entry
  var hashOffset = 8 + 255 * 4;
  var length = readUint32(buffer, hashOffset);
  hashOffset += 4;
  var crcOffset = hashOffset + 20 * length;
  var lengthOffset = crcOffset + 4 * length;
  var largeOffset = lengthOffset + 4 * length;
  var checkOffset = largeOffset;
  var indexes = new Array(length);
  for (var i = 0; i < length; i++) {
    var start = hashOffset + i * 20;
    var hash = bodec.toHex(bodec.slice(buffer, start, start + 20));
    var crc = readUint32(buffer, crcOffset + i * 4);
    var offset = readUint32(buffer, lengthOffset + i * 4);
    if (offset & 0x80000000) {
      offset = largeOffset + (offset &0x7fffffff) * 8;
      checkOffset = Math.max(checkOffset, offset + 8);
      offset = readUint64(buffer, offset);
    }
    indexes[i] = {
      hash: hash,
      offset: offset,
      crc: crc
    };
  }
  var packChecksum = bodec.toHex(bodec.slice(buffer, checkOffset, checkOffset + 20));
  var checksum = bodec.toHex(bodec.slice(buffer, checkOffset + 20, checkOffset + 40));
  if (sha1(bodec.slice(buffer, 0, checkOffset + 20)) !== checksum) {
    throw new Error("Checksum mistmatch");
  }

  var byHash = {};
  indexes.sort(function (a, b) {
    return a.offset - b.offset;
  });
  indexes.forEach(function (data) {
    byHash[data.hash] = {
      offset: data.offset,
      crc: data.crc,
    };
  });
  var offsets = indexes.map(function (entry) {
    return entry.offset;
  }).sort(function (a, b) {
    return a - b;
  });

  return {
    offsets: offsets,
    byHash: byHash,
    checksum: packChecksum
  };
}

function readUint32(buffer, offset) {
  return (buffer[offset] << 24 |
          buffer[offset + 1] << 16 |
          buffer[offset + 2] << 8 |
          buffer[offset + 3] << 0) >>> 0;
}

// Yes this will lose precision over 2^53, but that can't be helped when
// returning a single integer.
// We simply won't support packfiles over 8 petabytes. I'm ok with that.
function readUint64(buffer, offset) {
  var hi = (buffer[offset] << 24 |
            buffer[offset + 1] << 16 |
            buffer[offset + 2] << 8 |
            buffer[offset + 3] << 0) >>> 0;
  var lo = (buffer[offset + 4] << 24 |
            buffer[offset + 5] << 16 |
            buffer[offset + 6] << 8 |
            buffer[offset + 7] << 0) >>> 0;
  return hi * 0x100000000 + lo;
}
