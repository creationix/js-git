/*global define*/
define("js-git/mixins/path-to-entry", function () {
  "use strict";

  var modes = require('js-git/lib/modes');
  var encoders = require('js-git/lib/encoders');

  // Cache the tree entries by hash for faster path lookup.
  var cache = {};

  // Cached compiled directories that contain wildcards.
  var dirs = {};

  return function (repo) {
    if (!repo.submodules) repo.submodules = {};
    repo.pathToEntry = pathToEntry;
    var loadAs = repo.loadAs;
    if (loadAs) repo.loadAs = loadAsCached;
    var saveAs = repo.saveAs;
    if (saveAs) repo.saveAs = saveAsCached;
    var createTree = repo.createTree;
    if (createTree) repo.createTree = createTreeCached;

    // Monkeypatch loadAs to cache non-blobs
    function loadAsCached(type, hash, callback) {
      if (!callback) return loadAsCached.bind(repo, type, hash);
      if (hash in cache) {
        // console.log("LOAD CACHED", hash);
        return callback(null, encoders.normalizeAs(type, cache[hash]));
      }
      if (type === "blob") {
        return loadAs.apply(repo, arguments);
      }
      loadAs.call(repo, type, hash, function (err, body, hash) {
        if (body === undefined) return callback(err);
        cache[hash] = body;
        callback(null, body, hash);
      });
    }

    // Monkeypatch saveAs to cache non-blobs
    function saveAsCached(type, body, callback) {
      if (!callback) {
        return saveAsCached.bind(repo, type, body);
      }
      if (type === "blob") {
        return saveAs.apply(repo, arguments);
      }
      saveAs.call(repo, type, body, function (err, hash, body) {
        if (err) return callback(err);
        cache[hash] = body;
        callback(null, hash, body);
      });
    }

    // Monkeypatch saveAs to cache non-blobs
    function createTreeCached(entries, callback) {
      if (!callback) {
        return createTreeCached.bind(repo, entries);
      }
      createTree.call(repo, entries, function (err, hash, tree) {
        if (err) return callback(err);
        cache[hash] = tree;
        callback(null, hash, tree);
      });
    }

  };


  function pathToEntry(root, path, callback) {
    var repo = this;
    if (!callback) return pathToEntry.bind(repo, root, path);

    // Split path ignoring leading and trailing slashes.
    var parts = path.split("/").filter(String);
    var length = parts.length;
    var index = 0;

    // These contain the hash and mode of the path as we walk the segments.
    var mode = modes.tree;
    var hash = root;
    return walk();

    function patternCompile(source, target) {
      // Escape characters that are dangerous in regular expressions first.
      source = source.replace(/[\-\[\]\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
      // Extract all the variables in the source and target and replace them.
      source.match(/\{[a-z]+\}/g).forEach(function (match, i) {
        source = source.replace(match, "(.*)");
        target = target.replace(match, '$' + (i + 1));
      });
      var match = new RegExp("^" + source + "$");
      match.target = target;
      return match;
    }

    function compileDir(hash, tree, callback) {
      var left = 1;
      var done = false;
      var wilds = Object.keys(tree).filter(function (key) {
        return (modes.sym === tree[key].mode) && /\{[a-z]+\}/.test(key);
      });
      dirs[hash] = wilds;
      wilds.forEach(function (key, i) {
        if (done) return;
        var hash = tree[key].hash;
        var link = cache[hash];
        if (link) {
          wilds[i] = patternCompile(key, link);
          return;
        }
        left++;
        repo.loadAs("text", hash, function (err, link) {
          if (done) return;
          if (err) {
            done = true;
            return callback(err);
          }
          cache[hash] = link;
          wilds[i] = patternCompile(key, link);
          if (!--left) {
            done = true;
            callback();
          }
        });
      });
      if (!done && !--left) {
        done = true;
        callback();
      }
    }

    function walk(err) {
      if (err) return callback(err);
      var cached;
      outer:
      while (index < length) {
        // If the parent is a tree, look for our path segment
        if (mode === modes.tree) {
          cached = cache[hash];
          // If it's not cached yet, abort and resume later.
          if (!cached) return repo.loadAs("tree", hash, onValue);
          var name = parts[index];
          var entry = cached[name];
          if (!entry) {
            var dir = dirs[hash];
            if (!dir) return compileDir(hash, cached, walk);
            for (var i = 0, l = dir.length; i < l; i++) {
              var wild = dir[i];
              if (!wild.test(name)) continue;
              mode = modes.sym;
              hash = hash + "-" + name;
              cache[hash] = name.replace(wild, wild.target);
              break outer;
            }
            return callback();
          }
          index++;
          hash = entry.hash;
          mode = entry.mode;
          continue;
        }
        // If the parent is a symlink, adjust the path in-place and start over.
        if (mode === modes.sym) {
          cached = cache[hash];
          if (!cached) return repo.loadAs("text", hash, onValue);
          // Remove the tail and remove the symlink segment from the head.
          var tail = parts.slice(index);
          parts.length = index - 1;
          // Join the target resolving special "." and ".." segments.
          cached.split("/").forEach(onPart);
          // Add the tail back in.
          parts.push.apply(parts, tail);
          // Start over.  The already passed path will be cached and quite fast.
          hash = root;
          mode = modes.tree;
          index = 0;
          continue;
        }
        // If it's a submodule, jump over to that repo.
        if (mode === modes.commit) {
          var parentPath = parts.slice(0, index).join("/");
          var submodule = repo.submodules[parentPath];
          if (!submodule) {
            return callback(new Error("Missing submodule for path: " + parentPath));
          }
          cached = cache[hash];
          if (!cached) return submodule.loadAs("commit", hash, onValue);
          var childPath = parts.slice(index).join("/");
          return submodule.pathToEntry(cached.tree, childPath, callback);
        }
        return callback(new Error("Invalid path segment"));
      }

      // We've reached the final segment, let's preload symlinks and trees since
      // we don't mind caching those.

      var result;
      if (mode === modes.tree) {
        cached = cache[hash];
        if (!cached) return repo.loadAs("tree", hash, onValue);
        result = { tree: encoders.normalizeAs("tree", cached) };
      }
      else if (mode === modes.sym) {
        cached = cache[hash];
        if (!cached) return repo.loadAs("text", hash, onValue);
        result = { link: cached };
      }
      else if (mode === modes.commit) {
        cached = cache[hash];
        if (!cached) return repo.loadAs("commit", hash, onValue);
        result = { commit: encoders.normalizeAs("commit", cached) };
      }
      else {
        result = {};
      }
      result.mode = mode;
      result.hash = hash;

      // In the case of submodule traversal, the caller's repo is different
      return callback(null, result, repo);

      // Used by the symlink code to resolve the target against the path.
      function onPart(part) {
        // Ignore leading and trailing slashes as well as "." segments.
        if (!part || part === ".") return;
        // ".." pops a path segment from the stack
        if (part === "..") parts.pop();
        // New paths segments get pushed on top.
        else parts.push(part);
      }

    }

    function onValue(err, value) {
      if (value === undefined) return callback(err);
      // Don't let anyone change this value.
      if (typeof value === "object") Object.freeze(value);
      cache[hash] = value;
      return walk();
    }

  }

});