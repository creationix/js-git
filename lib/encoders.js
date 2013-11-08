var bops = require('bops');
var pathCmp = require('./pathcmp.js');

exports.commit = function encodeCommit(commit) {
  if (!commit.tree || !commit.author || !commit.message) {
    throw new TypeError("Tree, author, and message are require for commits");
  }
  var parents = commit.parents || (commit.parent ? [ commit.parent ] : []);
  if (!Array.isArray(parents)) {
    throw new TypeError("Parents must be an array");
  }
  var str = "tree " + commit.tree;
  for (var i = 0, l = parents.length; i < l; ++i) {
    str += "\nparent " + parents[i];
  }
  str += "\nauthor " + encodePerson(commit.author) +
         "\ncommitter " + encodePerson(commit.committer || commit.author) +
         "\n\n" + commit.message;
  return bops.from(str);
};

exports.tag = function encodeTag(tag) {
  if (!tag.object || !tag.type || !tag.tag || !tag.tagger || !tag.message) {
    throw new TypeError("Object, type, tag, tagger, and message required");
  }
  var str = "object " + tag.object +
    "\ntype " + tag.type +
    "\ntag " + tag.tag +
    "\ntagger " + encodePerson(tag.tagger) +
    "\n\n" + tag.message;
  return bops.from(str + "\n" + tag.message);
};

exports.tree = function encodeTree(tree) {
  var chunks = [];
  if (!Array.isArray(tree)) {
    tree = Object.keys(tree).map(function (name) {
      var entry = tree[name];
      entry.name = name;
      return entry;
    });
  }
  tree.sort(pathCmp).forEach(onEntry);
  return bops.join(chunks);

  function onEntry(entry) {
    chunks.push(
      bops.from(entry.mode.toString(8) + " " + entry.name + "\0"),
      bops.from(entry.hash, "hex")
    );
  }
};

exports.blob = function encodeBlob(blob) {
  if (bops.is(blob)) return blob;
  return bops.from(blob);
};

function encodePerson(person) {
  if (!person.name || !person.email) {
    throw new TypeError("Name and email are required for person fields");
  }
  return safe(person.name) +
    " <" + safe(person.email) + "> " +
    formatDate(person.date || new Date());
}

function safe(string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, "");
}

function formatDate(date) {
  var timezone = (date.timeZoneoffset || date.getTimezoneOffset()) / 60;
  var seconds = Math.floor(date.getTime() / 1000);
  return seconds + " " + (timezone > 0 ? "-0" : "0") + timezone + "00";
}
