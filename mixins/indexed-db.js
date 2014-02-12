"use strict";
/*global indexedDB*/

var encoders = require('js-git/lib/encoders');
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
}

function onError(evt) {
  console.error("error", evt.target.error);
}

function saveAs(type, body, callback, forcedHash) {
  var hash;
  try {
    body = encoders.normalizeAs(type, body);
    hash = forcedHash || encoders.hashAs(type, body);
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
    if (type !== "blob") {
      entry.body = encoders.normalizeAs(type, entry.body);
    }
    if (type !== entry.type) {
      return callback(new TypeError("Type mismatch"));
    }
    callback(null, entry.body, hash);
  };
  request.onerror = function(evt) {
    callback(new Error(evt.value));
  };
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
