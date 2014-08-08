"use strict";

var modes = require('../lib/modes');

module.exports = function (local, remote) {
  local.fetch = fetch;
  local.send = send;
  local.readRemoteRef = remote.readRef.bind(remote);
  local.updateRemoteRef = remote.updateRef.bind(remote);

  function fetch(ref, depth, callback) {
    if (!callback) return fetch.bind(local, ref, depth);
    sync(local, remote, ref, depth, callback);
  }

  function send(ref, callback) {
    if (!callback) return send.bind(local, ref);
    sync(remote, local, ref, Infinity, callback);
  }
};

// Download remote ref with depth
// Make sure to use Infinity for depth on github mounts or anything that
// doesn't allow shallow clones.
function sync(local, remote, ref, depth, callback) {
  if (typeof ref !== "string") throw new TypeError("ref must be string");
  if (typeof depth !== "number") throw new TypeError("depth must be number");

  var hasCache = {};

  remote.readRef(ref, function (err, hash) {
    if (!hash) return callback(err);
    importCommit(hash, depth, function (err) {
      if (err) return callback(err);
      callback(null, hash);
    });
  });

  // Caching has check.
  function check(type, hash, callback) {
    if (typeof type !== "string") throw new TypeError("type must be string");
    if (typeof hash !== "string") throw new TypeError("hash must be string");
    if (hasCache[hash]) return callback(null, true);
    local.hasHash(hash, function (err, has) {
      if (err) return callback(err);
      hasCache[hash] = has;
      callback(null, has);
    });
  }

  function importCommit(hash, depth, callback) {
    check("commit", hash, onCheck);

    function onCheck(err, has) {
      if (err || has) return callback(err);
      remote.loadAs("commit", hash, onLoad);
    }

    function onLoad(err, commit) {
      if (!commit) return callback(err || new Error("Missing commit " + hash));
      var i = 0;
      importTree(commit.tree, onImport);

      function onImport(err) {
        if (err) return callback(err);
        if (i >= commit.parents.length || depth <= 1) {
          return local.saveAs("commit", commit, onSave);
        }
        importCommit(commit.parents[i++], depth - 1, onImport);
      }
    }

    function onSave(err, newHash) {
      if (err) return callback(err);
      if (newHash !== hash) {
        return callback(new Error("Commit hash mismatch " + hash + " != " + newHash));
      }
      hasCache[hash] = true;
      callback();
    }
  }

  function importTree(hash, callback) {
    check("tree", hash, onCheck);

    function onCheck(err, has) {
      if (err || has) return callback(err);
      remote.loadAs("tree", hash, onLoad);
    }

    function onLoad(err, tree) {
      if (!tree) return callback(err || new Error("Missing tree " + hash));
      var i = 0;
      var names = Object.keys(tree);
      onImport();

      function onImport(err) {
        if (err) return callback(err);
        if (i >= names.length) {
          return local.saveAs("tree", tree, onSave);
        }
        var name = names[i++];
        var entry = tree[name];
        if (modes.isBlob(entry.mode)) {
          return importBlob(entry.hash, onImport);
        }
        if (entry.mode === modes.tree) {
          return importTree(entry.hash, onImport);
        }
        // Skip others.
        onImport();
      }
    }

    function onSave(err, newHash) {
      if (err) return callback(err);
      if (newHash !== hash) {
        return callback(new Error("Tree hash mismatch " + hash + " != " + newHash));
      }
      hasCache[hash] = true;
      callback();
    }
  }

  function importBlob(hash, callback) {
    check("blob", hash, onCheck);

    function onCheck(err, has) {
      if (err || has) return callback(err);
      remote.loadAs("blob", hash, onLoad);
    }

    function onLoad(err, blob) {
      if (!blob) return callback(err || new Error("Missing blob " + hash));
      local.saveAs("blob", blob, onSave);
    }

    function onSave(err, newHash) {
      if (err) return callback(err);
      if (newHash !== hash) {
        return callback(new Error("Blob hash mismatch " + hash + " != " + newHash));
      }
      hasCache[hash] = true;
      callback();
    }
  }
}
