"use strict";
/*global indexedDB*/

var codec = require('../lib/object-codec.js');
var sha1 = require('git-sha1');
var modes = require('../lib/modes.js');
var db;

mixin.init = init;

mixin.loadAs = loadAs;
mixin.saveAs = saveAs;
module.exports = mixin;

function init(callback) {

  db = null;
  var request = indexedDB.open("tedit", 1);

  // We can only create Object stores in a versionchange transaction.
  request.onupgradeneeded = function(evt) {
    var db = evt.target.result;

    if (evt.dataLoss && evt.dataLoss !== "none") {
      return callback(new Error(evt.dataLoss + ": " + evt.dataLossMessage));
    }

    // A versionchange transaction is started automatically.
    evt.target.transaction.onerror = onError;

    if(db.objectStoreNames.contains("objects")) {
      db.deleteObjectStore("objects");
    }
    if(db.objectStoreNames.contains("refs")) {
      db.deleteObjectStore("refs");
    }

    db.createObjectStore("objects", {keyPath: "hash"});
    db.createObjectStore("refs", {keyPath: "path"});
  };

  request.onsuccess = function (evt) {
    db = evt.target.result;
    callback();
  };
  request.onerror = onError;
}


function mixin(repo, prefix) {
  if (!prefix) throw new Error("Prefix required");
  repo.refPrefix = prefix;
  repo.saveAs = saveAs;
  repo.loadAs = loadAs;
  repo.readRef = readRef;
  repo.updateRef = updateRef;
  repo.hasHash = hasHash;
}

function onError(evt) {
  console.error("error", evt.target.error);
}

function saveAs(type, body, callback, forcedHash) {
  var hash;
  try {
    var buffer = codec.frame({type:type,body:body});
    hash = forcedHash || sha1(buffer);
  }
  catch (err) { return callback(err); }
  var trans = db.transaction(["objects"], "readwrite");
  var store = trans.objectStore("objects");
  var entry = { hash: hash, type: type, body: body };
  var request = store.put(entry);
  request.onsuccess = function() {
    // console.warn("SAVE", type, hash);
    callback(null, hash, body);
  };
  request.onerror = function(evt) {
    callback(new Error(evt.value));
  };
}

function loadAs(type, hash, callback) {
  // console.warn("LOAD", type, hash);
  var trans = db.transaction(["objects"], "readwrite");
  var store = trans.objectStore("objects");
  var request = store.get(hash);
  request.onsuccess = function(evt) {
    var entry = evt.target.result;
    if (!entry) return callback();
    if (type !== entry.type) {
      return callback(new TypeError("Type mismatch"));
    }
    callback(null, entry.body, hash);
  };
  request.onerror = function(evt) {
    callback(new Error(evt.value));
  };
}

function hasHash(type, hash, callback) {
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
  var key = this.refPrefix + "/" + ref;
  var trans = db.transaction(["refs"], "readwrite");
  var store = trans.objectStore("refs");
  var request = store.get(key);
  request.onsuccess = function(evt) {
    var entry = evt.target.result;
    if (!entry) return callback();
    callback(null, entry.hash);
  };
  request.onerror = function(evt) {
    callback(new Error(evt.value));
  };
}

function updateRef(ref, hash, callback) {
  var key = this.refPrefix + "/" + ref;
  var trans = db.transaction(["refs"], "readwrite");
  var store = trans.objectStore("refs");
  var entry = { path: key, hash: hash };
  var request = store.put(entry);
  request.onsuccess = function() {
    callback();
  };
  request.onerror = function(evt) {
    callback(new Error(evt.value));
  };
}
