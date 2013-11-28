var frame = require('../lib/frame.js');
var sha1 = require('../lib/sha1.js');
var decoders = require('../lib/decoders.js');
var decodePack = require('../lib/pack-codec.js').decodePack;
var applyDelta = require('../lib/apply-delta.js');
var inspect = require('util').inspect;

var nodes = {};
var links = [];
var items = {};
var hashes = {};
var left, num;

var onItem = decodePack(function (item) {
  if (left === undefined) {
    left = num = item.num;
  }
  else if (item) {
    left--;
    console.error("%s/%s left", left, num);
  }
  else {
    if (left) throw new Error(left + " items missing!");
  }
  if (item && item.body) {
    var hash = item.hash = sha1(frame(item.type, item.body));
    hashes[item.offset] = hash;
    items[hash] = item;

    if (item.type === "ofs-delta") {
      item.ref = hashes[item.offset - item.ref];
      item.type = "ref-delta";
    }
    if (item.type === "ref-delta") {
      var target = items[item.ref];
      item.type = target.type;
      item.body = applyDelta(item.body, target.body);
      delete items[hash];
      hash = item.hash = sha1(frame(item.type, item.body));
      hashes[item.offset] = hash;
      items[hash] = item;
    }

    var obj = item.obj = decoders[item.type](item.body);

    if (item.type === "commit") {
      var label = [];
      nodes[hash] = {
        color: "deepskyblue4",
        shape: "record",
        label: label
      };
      label.push("<hash> " + shorten(hash));
      label.push("<commit> " + obj.message.split("\n")[0].replace(/"/g, ''));
      links.push([
        '"' + hash + '":commit',
        '"' + obj.tree + '":hash',
      ]);
      obj.parents.forEach(function (parent) {
        links.push([
          '"' + hash + '":hash',
          '"' + parent + '":hash',
        ]);
      });
    }
    else if (item.type === "tree") {
      var label = [
        "<hash> " + shorten(hash),
      ];
      Object.keys(obj).forEach(function (name, i) {
        var key = "f" + i;
        label.push("<" + key + "> " + name);
        links.push([
          '"' + hash + '":' + key,
          '"' + obj[name].hash + '":hash',
        ]);
      });
      nodes[hash] = {
        color: "forestgreen",
        shape: "record",
        label: label
      };
    }
    else if (item.type === "blob") {
      nodes[hash] = {
        color: "firebrick4",
        shape: "record",
        label: [
          "<hash> " + shorten(hash),
          item.body.length + " bytes data"
        ]
      };
    }
  }

  if (item === undefined) printDot();
  console.error(inspect(item, {colors:true}));
});
process.stdin.on('data', onItem);
process.stdin.on('end', onItem);
process.stdin.resume();

function printDot() {
  var dot = [];
  Object.keys(nodes).forEach(function (hash) {
    var props = nodes[hash];
    dot.push('"' + hash + '" [\n' + Object.keys(props).map(function (name) {
      var value = props[name];
      if (Array.isArray(value)) value = value.join("|");
      return '  ' + name + ' = "' + value + '"';
    }).join("\n") + '\n];');
  });
  links.forEach(function (pair) {
    if (pair[2]) {
      dot.push(pair[0] + ' -> ' + pair[1] + ' [label="' + pair[2] + '"];');
    }
    else {
      dot.push(pair[0] + ' -> ' + pair[1] + ';');
    }
  });

  dot.unshift('graph [rankdir = "LR" aspect=1];');
  dot.unshift('digraph packfile {');
  dot.push('}');
  console.log(dot.join("\n\n"));
}

function shorten(hash) {
  return hash.substr(0, 6) + "..." + hash.substr(hash.length - 6);
}