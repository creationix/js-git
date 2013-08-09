var each = require('../helpers/each.js');
var map = require('../helpers/map.js');
var parallel = require('../helpers/parallel.js');
var parallelData = require('../helpers/parallel-data.js');
var encode = require('./encode.js');
var decode = require('./decode.js');
var pushToPull = require('push-to-pull');
var parsePack = pushToPull(require('./parse-pack.js'));
var platform = require('./platform.js');
var applyDelta = require('git-apply-delta');
var trace = platform.require("trace");
var bops = require('bops');
var sha1 = platform.require('sha1');

module.exports = repo;
function repo(db) {

  if (trace) {
    var originalRead = db.read;
    db.read = function read(path, callback) {
      if (!callback) return read.bind(this, path);
      originalRead(path, function (err, data) {
        if (err) return callback(err);
        trace("read", null, path);
        callback(null, data);
      });
    };
    var originalWrite = db.write;
    db.write = function write(path, data, callback) {
      if (!callback) return write.bind(this, path, data);
      originalWrite(path, data, function (err) {
        if (err) return callback(err);
        trace("write", null, path);
        callback();
      });
    };
    var originalLoad = db.load;
    db.load = function load(hash, callback) {
      if (!callback) return load.bind(this, hash);
      originalLoad(hash, function (err, object) {
        if (err) return callback(err);
        trace("load", null, hash + " " + object.type);
        callback(null, object);
      });
    };
    var originalSave = db.save;
    db.save = function save(object, callback) {
      if (!callback) return save.bind(this, object);
      originalSave(object, function (err, hash) {
        if (err) return callback(err);
        trace("save", null, hash + " " + object.type);
        callback(null, hash);
      });
    };
    var originalRemove = db.remove;
    db.remove = function remove(hash, callback) {
      if (!callback) return remove.bind(this, hash);
      originalRemove(hash, function (err) {
        if (err) return callback(err);
        trace("remove", null, hash);
        callback();
      });
    };
  }

  return {
    root: db.root,
    bare: !db.fs,
    init: db.init,
    saveBlob: saveBlob,
    saveTree: saveTree,
    saveCommit: saveCommit,
    saveTag: saveTag,
    loadBlob: loadBlob,
    loadTree: loadTree,
    loadCommit: loadCommit,
    loadTag: loadTag,
    load: load,
    saveRaw: db.save,
    loadRaw: db.load,
    remove: db.remove,
    updateHead: updateHead,
    get: get,
    readRaw: db.read,
    writeRaw: db.write,
    importRefs: importRefs,
    unpack: unpack,
    checkout: checkout,
    writeIndex: writeIndex,
  };

  function load(hash, callback) {
    if (!callback) return load.bind(this, hash);
    db.load(hash, function (err, object) {
      if (err) return callback(err);
      var decoded;
      try {
        decoded = decode[object.type](object.body);
      }
      catch (err) {
        return callback(err);
      }
      callback(null, decoded, object.type);
    });
  }

  function loadType(hash, type, callback) {
    if (!callback) return loadType.bind(this, hash, type);
    load(hash, function (err, result, resultType) {
      if (err) return callback(err);
      if (resultType !== type) {
        return callback(new Error("Expected " + type + ", but got " + resultType));
      }
      callback(null, result);
    });
  }

  function saveType(value, type, callback) {
    if (!callback) return saveType.bind(this, value, type);
    var body;
    try {
      body = encode[type](value);
    }
    catch (err) {
      return callback(err);
    }
    db.save({
      type: type,
      body: body
    }, callback);
  }

  function loadBlob(hash, callback) {
    return loadType(hash, "blob", callback);
  }

  function loadTree(hash, callback) {
    return loadType(hash, "tree", callback);
  }

  function loadCommit(hash, callback) {
    return loadType(hash, "commit", callback);
  }

  function loadTag(hash, callback) {
    return loadType(hash, "tag", callback);
  }

  function saveBlob(blob, callback) {
    return saveType(blob, "blob", callback);
  }

  function saveTree(tree, callback) {
    return saveType(tree, "tree", callback);
  }

  function saveCommit(commit, callback) {
    return saveType(commit, "commit", callback);
  }

  function saveTag(tag, callback) {
    return saveType(tag, "tag", callback);
  }

  function updateHead(hash, callback) {
    if (!callback) return updateHead.bind(this, hash);
    db.read("HEAD")(function (err, value) {
      if (err) return callback(err);
      if (value.substr(0, 4) !== "ref:") {
        return callback(new Error("HEAD must be symbolic ref"));
      }
      db.write(value.substr(4).trim(), hash + "\n", callback);
    });
  }

  function getHead(callback) {
    if (!callback) return getHead.bind(this);
    db.read("HEAD")(function (err, value) {
      if (err) return callback(err);
      if (value.substr(0, 4) !== "ref:") {
        return callback(new Error("HEAD must be symbolic ref"));
      }
      db.read(value.substr(4).trim(), function (err, hash) {
        if (err) return callback(err);
        callback(null, hash.trim());
      });
    });
  }

  function importRefs(refs, callback) {
    if (!callback) return importRefs.bind(this, refs);
    var tasks = [];
    each(refs, function (name, hash) {
      if (name === "HEAD" || name.indexOf('^') > 0) return;
      tasks.push(db.write(name, hash));
    });
    parallel(tasks)(callback);
  }

  function unpack(raw, opts, callback) {
    if (!callback) return unpack.bind(this, raw, opts);
    var packStream = parsePack(raw);
    var version, num, count = 0, deltas = 0;
    // hashes keyed by offset
    var hashes = {};
    var seen = {};
    var toDelete = {};
    var pending = {};
    var queue = [];

    packStream.read(function (err, stats) {
      if (err) return callback(err);
      version = stats.version;
      num = stats.num;
      packStream.read(onRead);
    });

    function onRead(err, object) {
      if (opts.onProgress) {
        var percent = Math.round(count / num * 100);
        opts.onProgress("Receiving objects: " + percent + "% (" + count++ + "/" + num + ")   " + (object ? "\r" : "\n"));
      }
      if (err) return callback(err);
      if (object === undefined) {
        hashes = null;
        return applyDeltas(err);
      }
      var length = object.body.length;
      if (length !== object.size) {
        return callback(new Error("Body size mismatch " + length + " != " + object.size));
      }
      db.save(object, function (err, hash) {
        if (err) return callback(err);
        hashes[object.offset] = hash;
        var ref = object.ref;
        if (ref) {
          deltas++;
          if (object.type === "ofs-delta") {
            ref = hashes[object.offset - ref];
          }
          var list = pending[ref];
          if (list) list.push(hash);
          else pending[ref] = [hash];
          toDelete[hash] = true;
        }
        else {
          seen[hash] = true;
        }
        return packStream.read(onRead);
      });
    }

    function applyDeltas() {
      Object.keys(pending).forEach(function (ref) {
        if (seen[ref]) {
          pending[ref].forEach(function (hash) {
            queue.push({hash:hash,ref:ref});
          });
          delete pending[ref];
        }
      });

      return queue.length ? check() : cleanup();
    }

    function check() {
      var item = queue.pop();
      if (!item) return applyDeltas();
      parallelData({
        target: db.load(item.ref),
        delta: db.load(item.hash)
      }, function (err, results) {
        if (err) return callback(err);
        var obj = {
          type: results.target.type,
          body: applyDelta(results.delta.body, results.target.body)
        };
        db.save(obj, function (err, hash) {
          if (err) return callback(err);
          var deps = pending[item.hash];
          if (deps) {
            pending[hash] = deps;
            delete pending[item.hash];
          }
          seen[hash] = true;
          return check();
        });
      });
    }

    function cleanup() {
      var hashes = Object.keys(toDelete);
      remove();
      function remove() {
        var jobs = [];
        while (hashes.length && jobs.length < 10) {
          jobs.push(db.remove(hashes.pop()));
        }
        if (!jobs.length) return callback();
        parallel(jobs)(function (err) {
          if (err) return callback(err);
          remove();
        });
      }
    }
  }

  function get(ref, callback) {
    if (!callback) return get.bind(this, ref);
    if (/^[0-9a-fA-F]{40}$/.test(ref)) return callback(null, ref);
    db.read(ref, function (err, value) {
      if (err) return callback(err);
      if (value.substr(0, 4) === "ref:") {
        return get(value.substr(4).trim(), callback);
      }
      return callback(null, value.trim());
    });
  }

  function writeIndex(files, callback) {
    if (!callback) return writeIndex.bind(this, files);
    // console.log("writeIndex", this, arguments);
    var index = new Array(files.length + 1);
    var fs = db.fs;

    // Index header
    var header = bops.create(12);
    // DIRC
    bops.writeUInt32BE(header, 0x44495243, 0);
    // VERSION 2
    bops.writeUInt32BE(header, 2, 4);
    // NUMBER OF ITEMS
    bops.writeUInt32BE(header, files.length, 8);
    index[0] = header;

    files.sort(function (a, b) {
      return a.path > b.path ? 1 :
             a.path < b.path ? -1 : 0;
    });

    var left = files.length;
    files.forEach(function (file, i) {
      var path = bops.from(file.path);
      // Length is item header + filename
      var length = 62 + path.length;
      // Pad to multiple of 8 to keep alignment within file.
      length += 8 - (length % 8);
      var item = index[i + 1] = bops.create(length);
      fs.stat(file.path, function (err, stat) {
        if (err) return onDone(err);

  // 32-bit ctime seconds, the last time a file's metadata changed
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.ctime[0], 0);
  // 32-bit ctime nanosecond fractions
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.ctime[1], 4);

  // 32-bit mtime seconds, the last time a file's data changed
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.mtime[0], 8);
  // 32-bit mtime nanosecond fractions
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.mtime[1], 12);
  // 32-bit dev
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.dev, 16);
  // 32-bit ino
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.ino, 20);
  // 32-bit mode, split into (high to low bits)
  // 4-bit object type
  //   valid values in binary are 1000 (regular file), 1010 (symbolic link)
  //   and 1110 (gitlink)
  // 3-bit unused
  // 9-bit unix permission. Only 0755 and 0644 are valid for regular files.
  // Symbolic links and gitlinks have value 0 in this field.
  // TODO: Implement check for symlinks
        // normal file 0x8000 (10000000)
        // symlink     0xa000 (10100000)
        // gitlink     0xe000 (11100000)
        // executable 0x1ed (0755)
        // normal     0x1a4 (0644)
        // bops.writeUInt32BE(item, 0x8000 | (stat.mode & 0x40 ? 0x1ed : 0x1a4), 28);
        bops.writeUInt32BE(item, stat.mode, 24);

  // 32-bit uid
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.uid, 28);
  // 32-bit gid
  //   this is stat(2) data
        bops.writeUInt32BE(item, stat.gid, 32);
  // 32-bit file size
  //   This is the on-disk size from stat(2), truncated to 32-bit.
        bops.writeUInt32BE(item, stat.size, 36);
  // 160-bit SHA-1 for the represented object
        bops.copy(bops.from(file.hash, "hex"), item, 40);
  // A 16-bit 'flags' field split into (high to low bits)
  // 1-bit assume-valid flag
  // 1-bit extended flag (must be zero in version 2)
  // 2-bit stage (during merge)
  // 12-bit name length if the length is less than 0xFFF; otherwise 0xFFF
  // is stored in this field.
        bops.writeUInt16BE(item, Math.max(0xfff, path.length), 60);
  // Entry path name (variable length) relative to top level directory
  //   (without leading slash). '/' is used as path separator. The special
  //   path components ".", ".." and ".git" (without quotes) are disallowed.
  //   Trailing slash is also disallowed.
  // The exact encoding is undefined, but the '.' and '/' characters
  // are encoded in 7-bit ASCII and the encoding cannot contain a NUL
  // byte (iow, this is a UNIX pathname).
        bops.copy(path, item, 62);
  // 1-8 nul bytes as necessary to pad the entry to a multiple of eight bytes
  // while keeping the name NUL-terminated.
        for (var i = 62 + path.length; i < item.length; i++) {
          item[i] = 0;
        }

        if (!--left) onDone();
      });
    });

    var done = false;
    function onDone(err) {
      if (done) return;
      done = true;
      if (err) return callback(err);
      var buf = bops.join(index);
      var checksum = bops.from(sha1(buf), "hex");
      db.write("index", bops.join([buf, checksum]), callback);
    }
  }

  function checkout(ref, callback) {
    if (!callback) return checkout.bind(this, ref);
    if (!db.fs) return callback(new Error("Cannot checkout in a bare repo"));
    var fs = db.fs;
    var files = [];
    get(ref, function (err, hash) {
      if (err) return callback(err);
      loadCommit(hash, function (err, commit) {
        if (err) return callback(err);
        loadTree(commit.tree, function (err, tree) {
          if (err) return callback(err);
          checkoutTree("", tree, function (err) {
            if (err) return callback(err);
            writeIndex(files, callback);
          });
        });
      });
    });

    function checkoutTree(root, tree, callback) {
      parallel(tree.map(function (entry) {
        var path = (root ? root + "/" : "") + entry.name;
        return function (callback) {
          load(entry.hash, function (err, object, type) {
            if (err) return callback(err);
            if (type === "blob") {
              var indexEntry = {path:path,hash:entry.hash};
              files.push(indexEntry);
              if (entry.mode & 0x2000) {
                return fs.symlink(path, bops.to(object), callback);
              }
              return fs.write(path, object, entry.mode, callback);
            }
            if (type === "tree") {
              return fs.mkdir(path, function (err) {
                if (err) return callback(err);
                checkoutTree(path, object, callback);
              });
            }
            return callback(new Error("Unexpected " + type + " in tree at " + path));
          });
        };
      }))(callback);
    }

  }

}

