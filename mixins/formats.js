"use strict";

var bodec = require('bodec');
var treeMap = require('../lib/object-codec').treeMap;

module.exports = function (repo) {
  var loadAs = repo.loadAs;
  repo.loadAs = newLoadAs;
  var saveAs = repo.saveAs;
  repo.saveAs = newSaveAs;

  function newLoadAs(type, hash, callback) {
    if (!callback) return newLoadAs.bind(repo, type, hash);
    var realType = type === "text" ? "blob":
                   type === "array" ? "tree" : type;
    return loadAs.call(repo, realType, hash, onLoad);

    function onLoad(err, body, hash) {
      if (body === undefined) return callback(err);
      if (type === "text") body = bodec.toUnicode(body);
      if (type === "array") body = toArray(body);
      return callback(err, body, hash);
    }
  }

  function newSaveAs(type, body, callback) {
    if (!callback) return newSaveAs.bind(repo, type, body);
    type = type === "text" ? "blob":
           type === "array" ? "tree" : type;
    if (type === "blob") {
      if (typeof body === "string") {
        body = bodec.fromUnicode(body);
      }
    }
    else if (type === "tree") {
      body = normalizeTree(body);
    }
    else if (type === "commit") {
      body = normalizeCommit(body);
    }
    else if (type === "tag") {
      body = normalizeTag(body);
    }
    return saveAs.call(repo, type, body, callback);
  }

};

function toArray(tree) {
  return Object.keys(tree).map(treeMap, tree);
}

function normalizeTree(body) {
  var type = body && typeof body;
  if (type !== "object") {
    throw new TypeError("Tree body must be array or object");
  }
  var tree = {}, i, l, entry;
  // If array form is passed in, convert to object form.
  if (Array.isArray(body)) {
    for (i = 0, l = body.length; i < l; i++) {
      entry = body[i];
      tree[entry.name] = {
        mode: entry.mode,
        hash: entry.hash
      };
    }
  }
  else {
    var names = Object.keys(body);
    for (i = 0, l = names.length; i < l; i++) {
      var name = names[i];
      entry = body[name];
      tree[name] = {
        mode: entry.mode,
        hash: entry.hash
      };
    }
  }
  return tree;
}

function normalizeCommit(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Commit body must be an object");
  }
  if (!(body.tree && body.author && body.message)) {
    throw new TypeError("Tree, author, and message are required for commits");
  }
  var parents = body.parents || (body.parent ? [ body.parent ] : []);
  if (!Array.isArray(parents)) {
    throw new TypeError("Parents must be an array");
  }
  var author = normalizePerson(body.author);
  var committer = body.committer ? normalizePerson(body.committer) : author;
  return {
    tree: body.tree,
    parents: parents,
    author: author,
    committer: committer,
    message: body.message
  };
}

function normalizeTag(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Tag body must be an object");
  }
  if (!(body.object && body.type && body.tag && body.tagger && body.message)) {
    throw new TypeError("Object, type, tag, tagger, and message required");
  }
  return {
    object: body.object,
    type: body.type,
    tag: body.tag,
    tagger: normalizePerson(body.tagger),
    message: body.message
  };
}

function normalizePerson(person) {
  if (!person || typeof person !== "object") {
    throw new TypeError("Person must be an object");
  }
  if (!person.name || !person.email) {
    throw new TypeError("Name and email are required for person fields");
  }
  return {
    name: person.name,
    email: person.email,
    date: person.date || new Date()
  };
}
