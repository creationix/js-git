"use strict";

var modes = require('../lib/modes.js');

module.exports = function (repo) {
  repo.createTree = createTree;

  function createTree(entries, callback) {
    if (!callback) return createTree.bind(null, entries);
    callback = singleCall(callback);
    if (!Array.isArray(entries)) {
      entries = Object.keys(entries).map(function (path) {
        var entry = entries[path];
        entry.path = path;
        return entry;
      });
    }

    // Tree paths that we need loaded
    var toLoad = {};
    function markTree(path) {
      while(true) {
        if (toLoad[path]) return;
        toLoad[path] = true;
        trees[path] = {
          add: [],
          del: [],
          tree: {}
        };
        if (!path) break;
        path = path.substring(0, path.lastIndexOf("/"));
      }
    }

    // Commands to run organized by tree path
    var trees = {};

    // Counter for parallel I/O operations
    var left = 1; // One extra counter to protect again zalgo cache callbacks.

    // First pass, stubs out the trees structure, sorts adds from deletes,
    // and saves any inline content blobs.
    entries.forEach(function (entry) {
      var index = entry.path.lastIndexOf("/");
      var parentPath = entry.path.substr(0, index);
      var name = entry.path.substr(index + 1);
      markTree(parentPath);
      var tree = trees[parentPath];
      var adds = tree.add;
      var dels = tree.del;

      if (!entry.mode) {
        dels.push(name);
        return;
      }
      var add = {
        name: name,
        mode: entry.mode,
        hash: entry.hash
      };
      adds.push(add);
      if (entry.hash) return;
      left++;
      repo.saveAs("blob", entry.content, function (err, hash) {
        if (err) return callback(err);
        add.hash = hash;
        check();
      });
    });

    // Preload the base trees
    if (entries.base) loadTree("", entries.base);

    // Check just in case there was no IO to perform
    check();

    function loadTree(path, hash) {
      left++;
      delete toLoad[path];
      repo.loadAs("tree", hash, function (err, tree) {
        if (err) return callback(err);
        trees[path].tree = tree;
        Object.keys(tree).forEach(function (name) {
          var childPath = path ? path + "/" + name : name;
          if (toLoad[childPath]) loadTree(childPath, tree[name].hash);
        });
        check();
      });
    }

    function check() {
      if (--left) return;
      findLeaves().forEach(processLeaf);
    }

    function processLeaf(path) {
      var entry = trees[path];
      delete trees[path];
      var tree = entry.tree;
      entry.del.forEach(function (name) {
        delete tree[name];
      });
      entry.add.forEach(function (item) {
        tree[item.name] = {
          mode: item.mode,
          hash: item.hash
        };
      });
      left++;
      repo.saveAs("tree", tree, function (err, hash, tree) {
        if (err) return callback(err);
        if (!path) return callback(null, hash, tree);
        var index = path.lastIndexOf("/");
        var parentPath = path.substring(0, index);
        var name = path.substring(index + 1);
        trees[parentPath].add.push({
          name: name,
          mode: modes.tree,
          hash: hash
        });
        if (--left) return;
        findLeaves().forEach(processLeaf);
      });
    }

    function findLeaves() {
      var paths = Object.keys(trees);
      var parents = {};
      paths.forEach(function (path) {
        if (!path) return;
        var parent = path.substring(0, path.lastIndexOf("/"));
        parents[parent] = true;
      });
      return paths.filter(function (path) {
        return !parents[path];
      });
    }
  }
};

function singleCall(callback) {
  var done = false;
  return function () {
    if (done) return console.warn("Discarding extra callback");
    done = true;
    return callback.apply(this, arguments);
  };
}
