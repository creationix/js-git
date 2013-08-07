var encode = require('./encode.js');
var decode = require('./decode.js');

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

}
