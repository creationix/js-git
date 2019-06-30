"use strict";
var bodec = require('bodec');
var inflate = require('../lib/inflate');
var deflate = require('../lib/deflate');
var codec = require('../lib/object-codec');
var parsePackEntry = require('../lib/pack-codec').parseEntry;
var applyDelta = require('../lib/apply-delta');
var sha1 = require('git-sha1');
var pathJoin = require('path').join;
var parseIndex = require('../lib/pack-index').parseIndex;

// The fs object has the following interface:
// - readFile(path) => binary
//   Must also call callback() with no arguments if the file does not exist.
// - readChunk(path, start, end) => binary
//   Must also call callback() with no arguments if the file does not exist.
// - writeFile(path, binary) =>
//   Must also make every directory up to parent of path.
// - readDir(path) => array<paths>
//   Must also call callback() with no arguments if the file does not exist.
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
  repo.hasHash = hasHash;
  repo.init = init;
  repo.setShallow = setShallow;

  function init(ref, callback) {
    if (!callback) return init.bind(null, ref);
    ref = ref || "refs/heads/master";
    var path = pathJoin(repo.rootPath, "HEAD");
    fs.writeFile(path, "ref: " + ref, callback);
  }

  function setShallow(ref, callback) {
    if (!callback) return setShallow.bind(null, ref);
    var path = pathJoin(repo.rootPath, "shallow");
    fs.writeFile(path, ref, callback);
  }

  function updateRef(ref, hash, callback) {
    if (!callback) return updateRef.bind(repo, ref, hash);
    var path = pathJoin(repo.rootPath, ref);
    var lock = path + ".lock";
    fs.writeFile(lock, bodec.fromRaw(hash + "\n"), function(err) {
      if(err) return callback(err);
      fs.rename(lock, path, callback);
    });
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
    // Try to read the object first.
    loadRaw(hash, function (err, data) {
      // If it already exists, we're done
      if (data) return callback();
      // Otherwise write a new file
      var tmp = path.replace(/[0-9a-f]+$/, 'tmp_obj_' + Math.random().toString(36).substr(2))
      fs.writeFile(tmp, buffer, function(err) {
        if(err) return callback(err);
        fs.rename(tmp, path, callback);
      });
    });
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

  function hasHash(hash, callback) {
    if (!callback) return hasHash.bind(repo, hash);
    loadRaw(hash, function (err, body) {
      if (err) return callback(err);
      return callback(null, !!body);
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
        if (index < 0) {
          var error = new Error("Can't find chunk starting at " + start);
          return callback(error);
        }
        var end = index + 1 < offsets.length ? offsets[index + 1] : -20;
        fs.readChunk(packFile, start, end, function (err, chunk) {
          if (!chunk) return callback(err);
          var raw;
          try {
            var entry = parsePackEntry(chunk);
            if (entry.type === "ref-delta") {
              return loadRaw.call(repo, entry.ref, onBase);
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
