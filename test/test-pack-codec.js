var bodec = require('bodec');
var run = require('./run.js');
var decoders = require('../lib/object-codec.js').decoders;
var encoders = require('../lib/object-codec.js').encoders;

// The thing we mean to test.
var codec = require('../lib/pack-codec.js');

var pack = require('./sample-pack.js');
var items = [];
var newPack;

function unpackStream(stream) {
  var meta, out = [], finished = false;
  var write = codec.decodePack(onItem);
  for (var i = 0, l = stream.length; i < l; i += 128) {
    var slice = bodec.slice(stream, i, i + 128);
    try {
      // console.log("SLICE", slice);
      write(slice);
    }
    catch (err) {
      throw err;
    }
  }
  write();

  function onItem(item) {
    // console.log("UNPACK", item);
    if (item === undefined) {
      finished = true;
    }
    else if (!meta) {
      meta = item;
    }
    else {
      out.push(item);
    }
  }
  if (!finished) throw new Error("unpack stream didn't finish");
  if (out.length !== meta.num) throw new Error("Item num mismatch");
  return out;
}


run([
  function testDecodePack() {
    var counts = {};
    items = unpackStream(pack).map(function (item) {
      counts[item.type] = counts[item.type] || 0;
      counts[item.type]++;
      if (item.type === "tree" || item.type === "tag" || item.type === "commit") {
        item.body = decoders[item.type](item.body);
      }
      return item;
    });
    if (counts.commit !== 6) throw new Error("Wrong number of commits parsed");
    if (counts.tree !== 4) throw new Error("Wrong number of trees parsed");
    if (counts.blob !== 4) throw new Error("Wrong number of blobs parsed");
    if (counts['ofs-delta'] !== 2) throw new Error("Wrong number of offset deltas parsed");
  },
  function testEncodePack() {
    var done = false;
    var outs = [];

    var write = codec.encodePack(function (item) {
      if (item === undefined) {
        done = true;
        return;
      }
      if (!bodec.isBinary(item)) throw new Error("encode output must be buffers");
      outs.push(item);
    });
    write({num:items.length});
    items.forEach(function (item) {
      if (!bodec.isBinary(item.body)) {
        item.body = encoders[item.type](item.body);
        }
      write(item);
    });
    write();

    if (!done) throw new Error("Output stream never ended");

    newPack = bodec.join(outs);
  },
  function verifyEncodePack() {
    try {
      unpackStream(newPack);
      if (bodec.toHex(pack) !== bodec.toHex(newPack)) {
        throw new Error("Final pack doesn't match original.");
      }
    }
    catch (err) {
      console.log(bodec.toHex(pack));
      console.log(bodec.toHex(newPack));
      throw err;
    }
  }
]);
