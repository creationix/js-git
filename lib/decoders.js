var indexOf = require('./indexof.js');
var parseOct = require('./parseoct.js');
var parseAscii = require('./parseascii.js');
var parseToHex = require('./parsetohex.js');

exports.commit = function decodeCommit(body) {
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
    key = parseAscii(body, start, i++);
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = parseAscii(body, start, i++);
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
  commit.message = parseAscii(body, i, body.length);
  return commit;
};

exports.tag = function decodeTag(body) {
  var i = 0;
  var start;
  var key;
  var tag = {};
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = parseAscii(body, start, i++);
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = parseAscii(body, start, i++);
    if (key === "tagger") value = decodePerson(value);
    tag[key] = value;
  }
  i++;
  tag.message = parseAscii(body, i, body.length);
  return tag;
};

exports.tree = function decodeTree(body) {
  var i = 0;
  var length = body.length;
  var start;
  var mode;
  var name;
  var hash;
  var tree = [];
  while (i < length) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    mode = parseOct(body, start, i++);
    start = i;
    i = indexOf(body, 0x00, start);
    name = parseAscii(body, start, i++);
    hash = parseToHex(body, i, i += 20);
    tree.push({
      mode: mode,
      name: name,
      hash: hash
    });
  }
  return tree;
};

exports.blob = function decodeBlob(body) {
  return body;
};

function decodePerson(string) {
  var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
  if (!match) throw new Error("Improperly formatted person string");
  var sec = parseInt(match[3], 10);
  var date = new Date(sec * 1000);
  date.timeZoneoffset = parseInt(match[4], 10) / 100 * -60;
  return {
    name: match[1],
    email: match[2],
    date: date
  };
}
