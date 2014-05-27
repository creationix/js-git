var bodec = require('bodec');

// (body) -> raw-buffer
var encoders = exports.encoders = {
  blob: encodeBlob,
  tree: encodeTree,
  commit: encodeCommit,
  tag: encodeTag
};

  // ({type:type, body:raw-buffer}) -> buffer
exports.frame = frame;

// (raw-buffer) -> body
var decoders = exports.decoders ={
  blob: decodeBlob,
  tree: decodeTree,
  commit: decodeCommit,
  tag: decodeTag
};

// (buffer) -> {type:type, body:raw-buffer}
exports.deframe = deframe;

// Export git style path sort in case it's wanted.
exports.treeSort = treeSort;

function encodeBlob(body) {
  if (!bodec.isBinary(body)) throw new TypeError("Blobs must be binary values");
  return body;
}

function treeSort(a, b) {
  var aa = a + "/";
  var bb = b + "/";
  return aa > bb ? 1 : aa < bb ? -1 : 0;
}

function encodeTree(body) {
  var tree = "";
  if (Array.isArray(body)) throw new TypeError("Tree must be in object form");
  var names = Object.keys(body).sort(treeSort);
  for (var i = 0, l = names.length; i < l; i++) {
    var name = names[i];
    var entry = body[name];
    tree += entry.mode.toString(8) + " " + bodec.encodeUtf8(name) +
            "\0" + bodec.decodeHex(entry.hash);
  }
  return bodec.fromRaw(tree);
}

function encodeTag(body) {
  var str = "object " + body.object +
    "\ntype " + body.type +
    "\ntag " + body.tag +
    "\ntagger " + formatPerson(body.tagger) +
    "\n\n" + body.message;
  return bodec.fromUnicode(str);
}

function encodeCommit(body) {
  var str = "tree " + body.tree;
  for (var i = 0, l = body.parents.length; i < l; ++i) {
    str += "\nparent " + body.parents[i];
  }
  str += "\nauthor " + formatPerson(body.author) +
         "\ncommitter " + formatPerson(body.committer) +
         "\n\n" + body.message;
  return bodec.fromUnicode(str);
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
  var seconds, offset;
  if (date.seconds) {
    seconds = date.seconds;
    offset = date.offset;
  }
  // Also accept Date instances
  else {
    seconds = Math.floor(date.getTime() / 1000);
    offset = date.getTimezoneOffset();
  }
  var neg = "+";
  if (offset <= 0) offset = -offset;
  else neg = "-";
  offset = neg + two(Math.floor(offset / 60)) + two(offset % 60);
  return seconds + " " + offset;
}

function frame(obj) {
  var type = obj.type;
  var body = obj.body;
  if (!bodec.isBinary(body)) body = encoders[type](body);
  return bodec.join([
    bodec.fromRaw(type + " " + body.length + "\0"),
    body
  ]);
}

function decodeBlob(body) {
  return body;
}

function decodeTree(body) {
  var i = 0;
  var length = body.length;
  var start;
  var mode;
  var name;
  var hash;
  var tree = {};
  while (i < length) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    mode = parseOct(body, start, i++);
    start = i;
    i = indexOf(body, 0x00, start);
    name = bodec.toUnicode(body, start, i++);
    hash = bodec.toHex(body, i, i += 20);
    tree[name] = {
      mode: mode,
      hash: hash
    };
  }
  return tree;
}

function decodeCommit(body) {
  var i = 0;
  var start;
  var key;
  var parents = [];
  var commit = {
    tree: "",
    parents: parents,
    author: "",
    committer: "",
    message: ""
  };
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = bodec.toRaw(body, start, i++);
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = bodec.toUnicode(body, start, i++);
    if (key === "parent") {
      parents.push(value);
    }
    else {
      if (key === "author" || key === "committer") {
        value = decodePerson(value);
      }
      commit[key] = value;
    }
  }
  i++;
  commit.message = bodec.toUnicode(body, i, body.length);
  return commit;
}

function decodeTag(body) {
  var i = 0;
  var start;
  var key;
  var tag = {};
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = bodec.toRaw(body, start, i++);
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = bodec.toUnicode(body, start, i++);
    if (key === "tagger") value = decodePerson(value);
    tag[key] = value;
  }
  i++;
  tag.message = bodec.toUnicode(body, i, body.length);
  return tag;
}

function decodePerson(string) {
  var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
  if (!match) throw new Error("Improperly formatted person string");
  return {
    name: match[1],
    email: match[2],
    date: {
      seconds: parseInt(match[3], 10),
      offset: parseInt(match[4], 10) / 100 * -60
    }
  };
}

function deframe(buffer, decode) {
  var space = indexOf(buffer, 0x20);
  if (space < 0) throw new Error("Invalid git object buffer");
  var nil = indexOf(buffer, 0x00, space);
  if (nil < 0) throw new Error("Invalid git object buffer");
  var body = bodec.slice(buffer, nil + 1);
  var size = parseDec(buffer, space + 1, nil);
  if (size !== body.length) throw new Error("Invalid body length.");
  var type = bodec.toRaw(buffer, 0, space);
  return {
    type: type,
    body: decode ? decoders[type](body) : body
  };
}

function indexOf(buffer, byte, i) {
  i |= 0;
  var length = buffer.length;
  for (;;i++) {
    if (i >= length) return -1;
    if (buffer[i] === byte) return i;
  }
}

function parseOct(buffer, start, end) {
  var val = 0;
  while (start < end) {
    val = (val << 3) + buffer[start++] - 0x30;
  }
  return val;
}

function parseDec(buffer, start, end) {
  var val = 0;
  while (start < end) {
    val = val * 10 + buffer[start++] - 0x30;
  }
  return val;
}
