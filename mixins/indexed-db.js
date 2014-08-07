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
  if (!callback) return saveAs.bind(this, type, body);
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
  if (!callback) return loadAs.bind(this, type, hash);
  loadRaw(hash, function (err, entry) {
    if (!entry) return callback(err);
    if (type !== entry.type) {
      return callback(new TypeError("Type mismatch"));
    }
    callback(null, entry.body, hash);
  });
}

function loadRaw(hash, callback) {
  var trans = db.transaction(["objects"], "readwrite");
  var store = trans.objectStore("objects");
  var request = store.get(hash);
  request.onsuccess = function(evt) {
    var entry = evt.target.result;
    if (!entry) return callback();
    return callback(null, entry);
  };
  request.onerror = function(evt) {
    callback(new Error(evt.value));
  };
}

function hasHash(hash, callback) {
  if (!callback) return hasHash.bind(this, hash);
  loadRaw(hash, function (err, body) {
    if (err) return callback(err);
    return callback(null, !!body);
  });
}

function readRef(ref, callback) {
  if (!callback) return readRef.bind(this, ref);
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
  if (!callback) return updateRef.bind(this, ref, hash);
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
