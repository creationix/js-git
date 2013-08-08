var each = require('../helpers/each.js');
var parallel = require('../helpers/parallel.js');
var encode = require('./encode.js');
var decode = require('./decode.js');
var pushToPull = require('push-to-pull');
var parsePack = pushToPull(require('./parse-pack.js'));

var platform = require('./platform.js');

module.exports = repo;
function repo(db) {
  return {
    root: db.root,
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
    getHead: getHead,
    readRaw: db.read,
    writeRaw: db.write,
    importRefs: importRefs,
    unpack: unpack,
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
    if (!callback) return unpack.bind(this, packStream);
    var packStream = parsePack(raw);
    var version, num, count = 0;
    var head, parts;

    packStream.read(function (err, stats) {
      if (err) return callback(err);
      version = stats.version,
      num = stats.num,
      packStream.read(onRead);
    });

    function onRead(err, object) {
      if (opts.onProgress) opts.onProgress(formatProgress() + (object ? "\r" : "\n"));
      if (object === undefined) {
        return callback(err);
      }
      var length = object.body.length;
      if (length !== object.size) {
        return callback(new Error("Body size mismatch " + length + " != " + object.size));
      }
      db.save(object, function (err, hash) {
        if (err) return callback(err);
        // TODO: record deltas so we can resolve them later.
        return packStream.read(onRead);
      });

    }

    function formatProgress() {
      var percent = Math.round(count / num * 100);
      return "Receiving objects: " + percent + "% (" + count++ + "/" + num + ")   ";
    }

  }

}
