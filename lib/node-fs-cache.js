var encoders = require('../lib/encoders.js');
var zlib = require('zlib');
var pathJoin = require('path').join;
var dirname = require('path').dirname;

module.exports = function (root) {
  var fs = require('fs');
  return {
    loadAs: loadAs,
    saveAs: saveAs,
  };

  function loadAs(type, hash, callback) {
    var path = toPath(type, hash);
    fs.readFile(path, function (err, body) {
      if (err) {
        if (err.code === 'ENOENT') return callback();
        return callback(err);
      }
      zlib.inflate(body, function (err, body) {
        if (err) return callback(err);
        if (type !== "blob") {
          try { body = JSON.parse(body.toString()); }
          catch (err) {return callback(err); }
        }
        callback(null, body, hash);
      });
    });
  }

  function saveAs(type, body, callback, forcedHash) {
    var hash, data, path;
    try {
      body = encoders.normalizeAs(type, body);
      hash = forcedHash || encoders.hashAs(type, body);
      data = type === "blob" ? body : JSON.stringify(body);
      path = toPath(type, hash);
    }
    catch (err) { return callback(err); }
    zlib.deflate(data, function (err, data) {
      if (err) return callback(err);
      mkdirp(dirname(path), function (err) {
        if (err) return callback(err);
        fs.writeFile(path, data, function (err) {
          if (err) return callback(err);
          callback(null, hash, body);
        });
      });
    });
  }

  function toPath(type, hash) {
    return pathJoin(root, hash.substring(0, 2), hash.substring(2) + "." + type);
  }

  function mkdirp(path, callback) {
    make();
    function make(err) {
      if (err) return callback(err);
      fs.mkdir(path, onmkdir);
    }
    function onmkdir(err) {
      if (err) {
        if (err.code === "ENOENT") return mkdirp(dirname(path), make);
        if (err.code === "EEXIST") return callback();
        return callback(err);
      }
      callback();
    }
  }
};
