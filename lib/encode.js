var bops = require('bops');

module.exports = {
  blob: encodeBlob,
  tree: encodeTree,
  commit: encodeCommit,
  tag: encodeTag
};

function encodeBlob(buffer) {
  if (typeof buffer === "string") buffer = bops.from(buffer);
  return {
    type: "blob",
    size: buffer.length,
    body: buffer
  };
}

function pathCmp(a, b) {
  a += "/"; b += "/";
  return a < b ? -1 : a > b ? 1 : 0;
}

function encodeTree(tree) {
  var chunks = [];
  Object.keys(tree).sort(pathCmp).forEach(function (name) {
    var entry = tree[name];
    chunks.push(
      bops.from(entry.mode.toString(8) + " " + name + "\0"),
      bops.from(entry.hash, "hex")
    );
  });
  var body = bops.join(chunks);
  return {
    type: "tree",
    size: body.length,
    body: body
  };
}

function encodeCommit(commit) {
  var str = "";
  Object.keys(commit).forEach(function (key) {
    if (key === "message") return;
    var value = commit[key];
    if (key === "parents") {
      value.forEach(function (value) {
        str += "parent " + value + "\n";
      });
    }
    else {
      str += key + " " + value + "\n";
    }
  });
  var body = bops.from(str + "\n" + commit.message);
  return {
    type: "commit",
    size: body.length,
    body: body
  };
}

function encodeTag(tag) {
  var str = "";
  Object.keys(commit).forEach(function (key) {
    if (key === "message") return;
    var value = commit[key];
    str += key + " " + value + "\n";
  });
  var body = bops.from(str + "\n" + commit.message);
  return {
    type: "tag",
    size: body.length,
    body: body
  };
}
