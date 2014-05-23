"use strict";

var codec = require('../lib/object-codec.js');
var bodec = require('bodec');
var inflate = require('../lib/inflate');
var deflate = require('../lib/deflate');

var sha1 = require('git-sha1');
var modes = require('../lib/modes.js');
var db;

mixin.init = init;

mixin.loadAs = loadAs;
mixin.saveAs = saveAs;
mixin.loadRaw = loadRaw;
mixin.saveRaw = saveRaw;
module.exports = mixin;

function mixin(repo, prefix) {
  if (!prefix) throw new Error("Prefix required");
  repo.refPrefix = prefix;
  repo.saveAs = saveAs;
  repo.saveRaw = saveRaw;
  repo.loadAs = loadAs;
  repo.loadRaw = loadRaw;
  repo.readRef = readRef;
  repo.updateRef = updateRef;
  repo.hasHash = hasHash;
}

function init(callback) {

  db = openDatabase('tedit', '1.0', 'tedit local data', 10 * 1024 * 1024);
  db.transaction(function (tx) {
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS objects (hash unique, body blob)'
    );
    tx.executeSql(
      'CREATE TABLE IF NOT EXISTS refs (path unique, value text)'
    );
  }, function () {
    console.error(arguments);
    callback(new Error("Problem initializing database"));
  }, function () {
    callback();
  });
}

function saveAs(type, body, callback) {
  /*jshint: validthis: true */
  if (!callback) return saveAs.bind(this, type, body);
  var hash, buffer;
  try {
    buffer = codec.frame({type:type,body:body});
    hash = sha1(buffer);
  }
  catch (err) { return callback(err); }
  this.saveRaw(hash, buffer, callback);
}

function saveRaw(hash, buffer, callback) {
  /*jshint: validthis: true */
  if (!callback) return saveRaw.bind(this, hash, buffer);
  var sql = 'INSERT INTO objects (hash, body) VALUES (?, ?)';
  db.transaction(function (tx) {
    var text;
    try {
      text = bodec.toBase64(deflate(buffer));
    }
    catch (err) {
      return callback(err);
    }
    tx.executeSql(sql, [hash, text], function () {
      callback(null, hash);
    });
  });
}

function loadAs(type, hash, callback) {
  /*jshint: validthis: true */
  if (!callback) return loadAs.bind(this, type, hash);
  loadRaw(hash, function (err, buffer) {
    if (!buffer) return callback(err);
    var parts, body;
    try {
      parts = codec.deframe(buffer);
      if (parts.type !== type) throw new Error("Type mismatch");
      body = codec.decoders[type](parts.body);
    }
    catch (err) {
      return callback(err);
    }
    callback(null, body);
  });
}

function loadRaw(hash, callback) {
  /*jshint: validthis: true */
  if (!callback) return loadRaw.bind(this, hash);
  var sql = 'SELECT * FROM objects WHERE hash=?';
  db.readTransaction(function (tx) {
    tx.executeSql(sql, [hash], function (tx, result) {
      if (!result.rows.length) return callback();
      var item = result.rows.item(0);
      var buffer;
      try {
        buffer = inflate(bodec.fromBase64(item.body));
      }
      catch (err) {
        return callback(err);
      }
      callback(null, buffer);
    }, function (tx, error) {
      callback(new Error(error.message));
    });
  });
}

function hasHash(type, hash, callback) {
  /*jshint: validthis: true */
  loadAs(type, hash, function (err, value) {
    if (err) return callback(err);
    if (value === undefined) return callback(null, false);
    if (type !== "tree") return callback(null, true);
    var names = Object.keys(value);
    next();
    function next() {
      if (!names.length) return callback(null, true);
      var name = names.pop();
      var entry = value[name];
      hasHash(modes.toType(entry.mode), entry.hash, function (err, has) {
        if (err) return callback(err);
        if (has) return next();
        callback(null, false);
      });
    }
  });
}

function readRef(ref, callback) {
  /*jshint: validthis: true */
  var key = this.refPrefix + "/" + ref;
  var sql = 'SELECT * FROM refs WHERE path=?';
  db.transaction(function (tx) {
    tx.executeSql(sql, [key], function (tx, result) {
      if (!result.rows.length) return callback();
      var item = result.rows.item(0);
      callback(null, item.value);
    }, function (tx, error) {
      callback(new Error(error.message));
    });
  });
}

function updateRef(ref, hash, callback) {
  /*jshint: validthis: true */
  var key = this.refPrefix + "/" + ref;
  var sql = 'INSERT INTO refs (path, value) VALUES (?, ?)';
  db.transaction(function (tx) {
    tx.executeSql(sql, [key, hash], function () {
      callback();
    }, function (tx, error) {
      callback(new Error(error.message));
    });
  });
}
