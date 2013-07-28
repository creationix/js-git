var bops = require('bops');

module.exports = {
  blob: decodeBlob,
  tree: decodeTree,
  commit: decodeCommit,
  tag: decodeTag
};

function decodeBlob(buffer) {
  return buffer;
}

function decodeTree(buffer) {
  var i = 0;
  var length = buffer.length;
  var start;
  var mode;
  var name;
  var hash;
  var tree = [];
  while (i < length) {
    start = i;
    i = indexOf(buffer, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    mode = parseOct(buffer, start, i++);
    start = i;
    i = indexOf(buffer, 0x00, start);
    name = bops.to(bops.subarray(buffer, start, i++));
    hash = bops.to(bops.subarray(buffer, i, i += 20), "hex");
    tree.push({
      mode: mode,
      name: name,
      hash: hash
    });
  }
  return tree;
}

function decodeCommit(buffer) {
  var i = 0;
  var start;
  var key;
  var commit = {};
  var parents = [];
  while (buffer[i] !== 0x0a) {
    start = i;
    i = indexOf(buffer, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = parseAscii(buffer, start, i++);
    start = i;
    i = indexOf(buffer, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = bops.to(bops.subarray(buffer, start, i++));
    if (key === "parent") {
      commit.parents = parents;
      parents.push(value);
    }
    else {
      commit[key] = value;
    }
  }
  i++;
  commit.message = bops.to(bops.subarray(buffer, i));
  return commit;
}

function decodeTag(buffer) {
  var i = 0;
  var start;
  var key;
  var tag = {};
  while (buffer[i] !== 0x0a) {
    start = i;
    i = indexOf(buffer, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = parseAscii(buffer, start, i++);
    start = i;
    i = indexOf(buffer, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = bops.to(bops.subarray(buffer, start, i++));
    tag[key] = value;
  }
  i++;
  tag.message = bops.to(bops.subarray(buffer, i));
  return tag;
}


function indexOf(buffer, byte, i) {
  i |= 0;
  var length = buffer.length;
  for (;;i++) {
    if (i >= length) return -1;
    if (buffer[i] === byte) return i;
  }
}

function parseAscii(buffer, start, end) {
  var val = "";
  while (start < end) {
    val += String.fromCharCode(buffer[start++]);
  }
  return val;
}

function parseOct(buffer, start, end) {
  var val = 0;
  while (start < end) {
    val = (val << 3) + buffer[start++] - 0x30;
  }
  return val;
}
