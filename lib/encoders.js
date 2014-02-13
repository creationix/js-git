"use strict";

var sha1 = require('sha1');
var binary = require('binary');
var modes = require('./modes.js');

// Run sanity tests at startup.
test();

module.exports = {
  frame: frame,
  normalizeAs: normalizeAs,
  normalizeBlob: normalizeBlob,
  normalizeTree: normalizeTree,
  normalizeCommit: normalizeCommit,
  normalizeTag: normalizeTag,
  encodeAs: encodeAs,
  encodeBlob: encodeBlob,
  encodeTree: encodeTree,
  encodeCommit: encodeCommit,
  encodeTag: encodeTag,
  hashAs: hashAs,
  pathCmp: pathCmp
};

function test() {
  // Test blob encoding
  var normalized = normalizeBlob("Hello World\n");
  var expected = "557db03de997c86a4a028e1ebd3a1ceb225be238";
  var hash = hashAs("blob", normalized);
  if (hash !== expected) {
    console.log({expected: expected, actual: hash, normalized: normalized});
    throw new Error("Invalid body hash");
  }

  // Test tree encoding
  hash = hashAs("tree", normalizeTree({ "greeting.txt": { mode: modes.file, hash: hash } }));
  if (hash !== "648fc86e8557bdabbc2c828a19535f833727fa62") {
    throw new Error("Invalid tree hash");
  }

  var date = new Date(1391790884000);
  date.timezoneOffset = 7 * 60;
  // Test commit encoding
  hash = hashAs("commit", normalizeCommit({
    tree: hash,
    author: {
      name: "Tim Caswell",
      email: "tim@creationix.com",
      date: date
    },
    message: "Test Commit\n"
  }));
  if (hash !== "500c37fc17988b90c82d812a2d6fc25b15354bf2") {
    throw new Error("Invalid commit hash");
  }

  // Test annotated tag encoding
  date = new Date(1391790910000);
  date.timezoneOffset = 7 * 60;
  hash = hashAs("tag", normalizeTag({
    object: hash,
    type: "commit",
    tag: "mytag",
    tagger: {
      name: "Tim Caswell",
      email: "tim@creationix.com",
      date: date,
    },
    message: "Tag it!\n"
  }));
  if (hash !== "49522787662a0183652dc9cafa5c008b5a0e0c2a") {
    throw new Error("Invalid annotated tag hash");
  }
}

function encodeAs(type, body) {
  if (type === "blob")   return encodeBlob(body);
  if (type === "tree")   return encodeTree(body);
  if (type === "commit") return encodeCommit(body);
  if (type === "tag")    return encodeTag(body);
}

function normalizeAs(type, body) {
  if (type === "blob")   return normalizeBlob(body);
  if (type === "tree")   return normalizeTree(body);
  if (type === "commit") return normalizeCommit(body);
  if (type === "tag")    return normalizeTag(body);
}

// Calculate a git compatable hash by git encoding the body and prepending a
// git style frame header and calculating the sha1 sum of that.
function hashAs(type, body) {
  var encoded = encodeAs(type, body);
  var sum = sha1();
  sum.update(frame(type, encoded.length));
  sum.update(encoded);
  return sum.digest();
}

function frame(type, length) {
  return type + " " + length + "\0";
}

function normalizeBlob(body) {
  var type = typeof body;
  if (type === "string") {
    return binary.fromRaw(body);
  }
  if (body && type === "object") {
    if (body.constructor.name === "ArrayBuffer") body = new Uint8Array(body);
    if (typeof body.length === "number") {
      return body;//binary.toRaw(body);
    }
  }
  throw new TypeError("Blob body must be raw string, ArrayBuffer or byte array");
}

function encodeBlob(body) {
  return body;
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

function encodeTree(body) {
  var tree = "";
  var names = Object.keys(body).sort(pathCmp);
  for (var i = 0, l = names.length; i < l; i++) {
    var name = names[i];
    var entry = body[name];
    tree += entry.mode.toString(8) + " " + name +
            "\0" + binary.decodeHex(entry.hash);
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

function encodeCommit(body) {
  var str = "tree " + body.tree;
  for (var i = 0, l = body.parents.length; i < l; ++i) {
    str += "\nparent " + body.parents[i];
  }
  str += "\nauthor " + formatPerson(body.author) +
         "\ncommitter " + formatPerson(body.committer) +
         "\n\n" + body.message;
  return binary.encodeUtf8(str);
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

function encodeTag(body) {
  var str = "object " + body.object +
    "\ntype " + body.type +
    "\ntag " + body.tag +
    "\ntagger " + formatPerson(body.tagger) +
    "\n\n" + body.message;
  return binary.encodeUtf8(str);
}

// Tree entries are sorted by the byte sequence that comprises
// the entry name. However, for the purposes of the sort
// comparison, entries for tree objects are compared as if the
// entry name byte sequence has a trailing ASCII '/' (0x2f).
function pathCmp(a, b) {
  // TODO: this spec seems to be wrong.  It doesn't match the sort order used
  // by real git.
  // a = binary.encodeUtf8(a) + "/";
  // b = binary.encodeUtf8(b) + "/";
  return a < b ? -1 : a > b ? 1 : 0;
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

function formatPerson(person) {
  return safe(person.name) +
    " <" + safe(person.email) + "> " +
    formatDate(person.date);
}

function safe(string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, "");
}

function two(num) {
  return (num < 10 ? "0" : "") + num;
}

function formatDate(date) {
  var offset = date.timezoneOffset || date.getTimezoneOffset();
  var neg = "+";
  if (offset <= 0) offset = -offset;
  else neg = "-";
  offset = neg + two(Math.floor(offset / 60)) + two(offset % 60);
  var seconds = Math.floor(date.getTime() / 1000);
  return seconds + " " + offset;
}
