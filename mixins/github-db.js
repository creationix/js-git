"use strict";

var normalizeAs = require('../lib/encoders').normalizeAs;
var hashAs = require('../lib/encoders').hashAs;
var modes = require('../lib/modes');
var xhr = require('../lib/xhr');
var binary = require('bodec');

var modeToType = {
  "040000": "tree",
  "100644": "blob",  // normal file
  "100755": "blob",  // executable file
  "120000": "blob",  // symlink
  "160000": "commit" // gitlink
};

var encoders = {
  commit: encodeCommit,
  tag: encodeTag,
  tree: encodeTree,
  blob: encodeBlob
};

var decoders = {
  commit: decodeCommit,
  tag: decodeTag,
  tree: decodeTree,
  blob: decodeBlob,
};

var emptyBlob = hashAs("blob", "");
var emptyTree = hashAs("tree", []);


// Implement the js-git object interface using github APIs
module.exports = function (repo, root, accessToken) {

  var apiRequest = xhr(root, accessToken);

  repo.loadAs = loadAs;         // (type, hash) -> value, hash
  repo.saveAs = saveAs;         // (type, value) -> hash, value
  repo.readRef = readRef;       // (ref) -> hash
  repo.updateRef = updateRef;   // (ref, hash) -> hash
  repo.createTree = createTree; // (entries) -> hash, tree

  function loadAs(type, hash, callback) {
    // Github doesn't like empty trees, but we know them already.
    if (type === "tree" && hash === emptyTree) return callback(null, {}, hash);
    apiRequest("GET", "/repos/:root/git/" + type + "s/" + hash, onValue);

    function onValue(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status < 200 || xhr.status >= 500) {
        return callback(new Error("Invalid HTTP response: " + xhr.statusCode + " " + result.message));
      }
      if (xhr.status >= 300 && xhr.status < 500) return callback();
      var body;
      try { body = decoders[type].call(repo, result); }
      catch (err) { return callback(err); }
      if (hashAs(type, body) !== hash) {
        if (fixDate(type, body, hash)) console.log(type + " repaired", hash);
        else console.warn("Unable to repair " + type, hash);
      }
      return callback(null, body, hash);
    }
  }

  function saveAs(type, body, callback) {
    var request;
    try {
      body = normalizeAs(type, body);
      request = encoders[type](body);
    }
    catch (err) {
      return callback(err);
    }

    // Github doesn't allow creating empty trees.
    if (type === "tree" && request.tree.length === 0) {
      return callback(null, emptyTree, body);
    }
    return apiRequest("POST", "/repos/:root/git/" + type + "s", request, onWrite);

    function onWrite(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      return callback(null, result.sha, body);
    }
  }

  // Create a tree with optional deep paths and create new blobs.
  // Entries is an array of {mode, path, hash|content}
  // Also deltas can be specified by setting entries.base to the hash of a tree
  // in delta mode, entries can be removed by specifying just {path}
  function createTree(entries, callback) {
    var toDelete = entries.base && entries.filter(function (entry) {
      return !entry.mode;
    }).map(function (entry) {
      return entry.path;
    });
    if (toDelete && toDelete.length) return slowUpdateTree(entries, toDelete, callback);
    return fastUpdateTree(entries, callback);
  }

  function fastUpdateTree(entries, callback) {
    var request = { tree: entries.map(mapTreeEntry) };
    if (entries.base) request.base_tree = entries.base;

    apiRequest("POST", "/repos/:root/git/trees", request, onWrite);

    function onWrite(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      return callback(null, result.sha, decoders.tree(result));
    }
  }

  // Github doesn't support deleting entries via the createTree API, so we
  // need to manually create those affected trees and modify the request.
  function slowUpdateTree(entries, toDelete, callback) {
    callback = singleCall(callback);
    var root = entries.base;

    var left = 0;

    // Calculate trees that need to be re-built and save any provided content.
    var parents = {};
    toDelete.forEach(function (path) {
      var parentPath = path.substr(0, path.lastIndexOf("/"));
      var parent = parents[parentPath] || (parents[parentPath] = {
        add: {}, del: []
      });
      var name = path.substr(path.lastIndexOf("/") + 1);
      parent.del.push(name);
    });
    var other = entries.filter(function (entry) {
      if (!entry.mode) return false;
      var parentPath = entry.path.substr(0, entry.path.lastIndexOf("/"));
      var parent = parents[parentPath];
      if (!parent) return true;
      var name = entry.path.substr(entry.path.lastIndexOf("/") + 1);
      if (entry.hash) {
        parent.add[name] = {
          mode: entry.mode,
          hash: entry.hash
        };
        return false;
      }
      left++;
      repo.saveAs("blob", entry.content, function(err, hash) {
        if (err) return callback(err);
        parent.add[name] = {
          mode: entry.mode,
          hash: hash
        };
        if (!--left) onParents();
      });
      return false;
    });
    if (!left) onParents();

    function onParents() {
      Object.keys(parents).forEach(function (parentPath) {
        left++;
        // TODO: remove this dependency on pathToEntry
        repo.pathToEntry(root, parentPath, function (err, entry) {
          if (err) return callback(err);
          var tree = entry.tree;
          var commands = parents[parentPath];
          commands.del.forEach(function (name) {
            delete tree[name];
          });
          for (var name in commands.add) {
            tree[name] = commands.add[name];
          }
          repo.saveAs("tree", tree, function (err, hash, tree) {
            if (err) return callback(err);
            other.push({
              path: parentPath,
              hash: hash,
              mode: modes.tree
            });
            if (!--left) {
              other.base = entries.base;
              if (other.length === 1 && other[0].path === "") {
                return callback(null, hash, tree);
              }
              fastUpdateTree(other, callback);
            }
          });
        });
      });
    }
  }


  function readRef(ref, callback) {
    if (!(/^refs\//).test(ref)) {
      return callback(new TypeError("Invalid ref: " + ref));
    }
    return apiRequest("GET", "/repos/:root/git/" + ref, onRef);

    function onRef(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status === 404) return callback();
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      return callback(null, result.object.sha);
    }
  }

  function updateRef(ref, hash, callback) {
    if (!(/^refs\//).test(ref)) {
      return callback(new Error("Invalid ref: " + ref));
    }
    return apiRequest("PATCH", "/repos/:root/git/" + ref, {
      sha: hash
    }, onResult);

    function onResult(err, xhr, result) {
      if (err) return callback(err);
      if (xhr.status === 422 && result.message === "Reference does not exist") {
        return apiRequest("POST", "/repos/:root/git/refs", {
          ref: ref,
          sha: hash
        }, onResult);
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        return callback(new Error("Invalid HTTP response: " + xhr.status + " " + result.message));
      }
      if (err) return callback(err);
      callback(null, hash);
    }

  }

};

// GitHub has a nasty habit of stripping whitespace from messages and loosing
// the timezone.  This information is required to make our hashes match up, so
// we guess it by mutating the value till the hash matches.
// If we're unable to match, we will just force the hash when saving to the cache.
function fixDate(type, value, hash) {
  if (type !== "commit" && type !== "tag") return;
  // Add up to 2 extra newlines and try all 30-minutes timezone offsets.
  for (var x = 0; x < 3; x++) {
    for (var i = -720; i < 720; i += 30) {
      if (type === "commit") {
        value.author.date.timezoneOffset = i;
        value.committer.date.timezoneOffset = i;
      }
      else if (type === "tag") {
        value.tagger.date.timezoneOffset = i;
      }
      if (hash === hashAs(type, value)) return true;
    }
    value.message += "\n";
  }
  // Guessing failed, remove the temporary offset.
  if (type === "commit") {
    delete value.author.date.timezoneOffset;
    delete value.committer.date.timezoneOffset;
  }
  else if (type === "tag") {
    delete value.tagger.date.timezoneOffset;
  }
}

function mapTreeEntry(entry) {
  if (!entry.mode) throw new TypeError("Invalid entry");
  var mode = modeToString(entry.mode);
  var item = {
    path: entry.path,
    mode: mode,
    type: modeToType[mode]
  };
  // Magic hash for empty file since github rejects empty contents.
  if (entry.content === "") entry.hash = emptyBlob;

  if (entry.hash) item.sha = entry.hash;
  else item.content = entry.content;
  return  item;
}

function encodeCommit(commit) {
  var out = {};
  out.message = commit.message;
  out.tree = commit.tree;
  if (commit.parents) out.parents = commit.parents;
  else if (commit.parent) out.parents = [commit.parent];
  else commit.parents = [];
  if (commit.author) out.author = encodePerson(commit.author);
  if (commit.committer) out.committer = encodePerson(commit.committer);
  return out;
}

function encodeTag(tag) {
  return {
    tag: tag.tag,
    message: tag.message,
    object: tag.object,
    tagger: encodePerson(tag.tagger)
  };
}

function encodePerson(person) {
  return {
    name: person.name,
    email: person.email,
    date: (person.date || new Date()).toISOString()
  };
}

function encodeTree(tree) {
  return {
    tree: Object.keys(tree).map(function (name) {
      var entry = tree[name];
      var mode = modeToString(entry.mode);
      return {
        path: name,
        mode: mode,
        type: modeToType[mode],
        sha: entry.hash
      };
    })
  };
}

function encodeBlob(blob) {
  if (typeof blob === "string") return {
    content: binary.encodeUtf8(blob),
    encoding: "utf-8"
  };
  if (binary.isBinary(blob)) return {
    content: binary.toBase64(blob),
    encoding: "base64"
  };
  throw new TypeError("Invalid blob type, must be binary of string");
}

function modeToString(mode) {
  var string = mode.toString(8);
  // Github likes all modes to be 6 chars long
  if (string.length === 5) string = "0" + string;
  return string;
}

function decodeCommit(result) {
  return {
    tree: result.tree.sha,
    parents: result.parents.map(function (object) {
      return object.sha;
    }),
    author: pickPerson(result.author),
    committer: pickPerson(result.committer),
    message: result.message
  };
}

function decodeTag(result) {
  return {
    object: result.object.sha,
    type: result.object.type,
    tag: result.tag,
    tagger: pickPerson(result.tagger),
    message: result.message
  };
}

function decodeTree(result) {
  var tree = {};
  result.tree.forEach(function (entry) {
    tree[entry.path] = {
      mode: parseInt(entry.mode, 8),
      hash: entry.sha
    };
  });
  return tree;
}

function decodeBlob(result) {
  if (result.encoding === 'base64') {
    return binary.fromBase64(result.content.replace(/\n/g, ''));
  }
  if (result.encoding === 'utf-8') {
    return binary.fromUtf8(result.content);
  }
  throw new Error("Unknown blob encoding: " + result.encoding);
}

function pickPerson(person) {
  return {
    name: person.name,
    email: person.email,
    date: parseDate(person.date)
  };
}

function parseDate(string) {
  // TODO: test this once GitHub adds timezone information
  var match = string.match(/(-?)([0-9]{2}):([0-9]{2})$/);
  var date = new Date(string);
  date.timezoneOffset = 0;
  if (match) {
    date.timezoneOffset = (match[1] === "-" ? 1 : -1) * (
      parseInt(match[2], 10) * 60 + parseInt(match[3], 10)
    );
  }
  return date;
}

function singleCall(callback) {
  var done = false;
  return function () {
    if (done) return console.warn("Discarding extra callback");
    done = true;
    return callback.apply(this, arguments);
  };
}
