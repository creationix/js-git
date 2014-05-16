"use strict";

var modes = require('./modes');

// options.encrypt(plain) -> encrypted
// options.decrypt(encrypted) -> plain
// options.shouldEncrypt(path) -> boolean
// options.getRootTree() => hash
// options.setRootTree(hash) =>
module.exports = function (repo, options) {
  var toWrite = {};
  var callbacks = [];
  var writing = false;

  return {
    readFile: readFile,
    writeFile: writeFile,
    readDir: readDir
  };

  function readFile(path, callback) {
    if (!callback) return readFile.bind(null, path);
    options.getRootTree(onRootTree);

    function onRootTree(err, hash) {
      if (!hash) return callback(err);
      repo.pathToEntry(hash, path, onEntry);
    }

    function onEntry(err, entry) {
      if (!entry || !modes.isFile(entry.mode)) return callback(err);
      repo.loadAs("blob", entry.hash, callback);
    }
  }

  function writeFile(path, binary, callback) {
    if (!callback) return writeFile.bind(null, path, binary);
    toWrite[path] = binary;
    callbacks.push(callback);
    check();
  }

  function readDir(path, callback) {
    if (!callback) return readDir.bind(null, path);

    options.getRootTree(onRootTree);

    function onRootTree(err, hash) {
      if (!hash) return callback(err);
      repo.pathToEntry(hash, path, onEntry);
    }

    function onEntry(err, entry) {
      if (!entry || entry.mode !== modes.tree) return callback(err);
      repo.loadAs("tree", entry.hash, onTree);
    }

    function onTree(err, tree) {
      if (!tree) return callback(err);
      callback(null, Object.keys(tree));
    }
  }

  function check() {
    if (writing || !callbacks.length) return;
    writing = true;
    options.getRootTree(onRootTree);

    function onRootTree(err, hash) {
      if (err) return callall(err);
      var files = pullFiles();
      if (hash) files.base = hash;
      repo.createTree(files, onNewTree);
    }

    function onNewTree(err, hash) {
      if (err) return callall(err);
      options.setRootTree(hash, onSaveRoot);

    }

    function onSaveRoot(err) {
      if (err) return callall(err);
      toWrite = {};
      writing = false;
      callall();
    }
  }

  function pullFiles() {
    var files = Object.keys(toWrite).map(function (path) {
      var content = toWrite[path];
      var mode = modes.blob;
      if (options.shouldEncrypt && options.shouldEncrypt(path)) {
        mode = modes.exec;
        content = options.encrypt(content);
      }
      return {
        path: path,
        mode: mode,
        content: content
      };
    });
    return files;
  }

  function callall(err) {
    callbacks.splice(0, callbacks.length).forEach(function (callback) {
      callback(err);
    });
  }
};
