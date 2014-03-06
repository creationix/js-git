var bodec = require('bodec');
var run = require('./run.js');
var decoders = require('../lib/object-codec.js').decoders;
var encoders = require('../lib/object-codec.js').encoders;

// The thing we mean to test.
var codec = require('../lib/pack-codec.js');


// This is a small sample packfile with couple offset deltas
// pack-5851ce932ec42973b51d631afe25da247c3dc49a.pack
var pack = bodec.fromBase64('UEFDSwAAAAIAAAAQnQ54nJ3MWwoCMQxA0f+uIhtQ0nYeKYgobsENZNoEC/OQMTK6e2cN/l4411YRYCo5kseITVLpSmAfOVLSnFJB6kJqSukDuSevMhu0moed9CmrKjKFwpIxtT7TINh2vSqReHX8tseywr1OcOPXJuMIJ6vTJa/CVpe5fo55mc7gY2p86LFBOGCH6PY6VTP5x7prKfAVA54Xe+yLWTbQOor7AZUCSPmRDnicnctRCgIhEADQf08xFyjGUVeFiKIrdAEdZ0lYd8OM7fh1hn4fvNFFQEi8JCcuCoWSmakwY8xoHGMxkdgimZjVM3VZB8wUPMUJLWrRPml0IdspuJl1JHJBSijGRlLpPR5bh3ttcEuvXZYFTqO2C3dJo25r/Rx5a2fQJlpNHgnhgBOi+mmrY8g/V11LgVV2mOsi6guDiEL9mA94nJ3PTWrDMBBA4b1OMRdosDT6hRIKvkIuIMkjd6htGXVCkts3Z+j2wbd4MohA+5Cai874uiQXQmuIjagsAWMp3rWS0WCM6syDDgGbDCXEmhz5Zl00iayv2mpyHk2xVLVZlhJUvst3H3DjHeb8+6Btg0/h/asOysL94Oel9v0KGpPVxjtE+Jj8NKl33VmE/mPV3M8XrO8x4WOFkusPSIc+eOUjb9B4I/UHHmNMM5QOeJydy1sKwjAQRuH3rGI2oGQmlzYgIrgDcQNp8hcDTSsxostXt+B5/OD0BpAzMJmzJJs4J5Fh5OiCsB3nMFvoOAakkaHusWHtpJm1y9YYb4KXSawgR/GY9MQ+8OB/TZhVfPbb1uhaKp3j44VloUMv9ZQaYi/bWt77tNUjsQmWxTttaae91uqrtfSOf151wRorqN9Ac1mgPgYNRBeSDnicncvdCcIwEADg90xxCyiXn6YGRBRXcIG75IKBppX2xI6vM/j6waerCGAozFyCiA2Jx+QJh5Rd8l5cHUiSdcVTzeZFq8wKY5TkamYsIWO1Xkau8VRdHNhF5BLJsUWqht76XFZ4tA532j4yTXDW1q95FdK2zG0/5qVfwPoUrIshWThgRDQ/7U1V/rnmVgpsSxdQ2dV8AbwRRT6TC3icnczNCQIxEEDhe6qYBpT8JwuyCHvybgOTmOBAsoE4ouUrluD1wfd4lgLexpqjL9G5kG6YUtY56ohqccbVaEzQoaLXAp98HxOu1GHDx6u0Biemfs6zINPY6X3Mo6+gzGKV9jYEOEgvpfjWTszlHysuOzFhg+03ER9fQDcKqQl4nDM0MDAzMVFIL0pNLcnMS9crqShhEHwQ5TRdT6bE+tY/8blzjRyr9lYcMoSoy60kVmVeajlYifjVm28/SzW0d12ZKCB++trFC8ZKOxBKjMBqauylWlkm6kbyCrH0Gp01vHQ9NnMNAFftOrq1AXic80jNyclXCM8vyknhckxJUSjOz03lAgBQjAcOPXicS8zLL8lILVJIy8xJ5QIAI9cEvLEBeJyrTC1RSMzLL8lILVJIy8xJ5QIAOsAGLmWAPnicm8lYOqEUAAX6AhVkEHicKw2aEAQABEABqqoCeJwzNDAwMzFRyK1ML0pNLcnMS9crqShhEHwQ5TRdT6bE+tY/8blzjRyr9lYcAgAxUhBDqAJ4nDM0MDAzMVFIL0pNLcnMS9crqShhEHwQ5TRdT6bE+tY/8blzjRyr9lYcAgAPuQ9dqAJ4nDM0MDAzMVFIL0pNLcnMS9crqShhCK3dYPty+oksL6Y+ub1WMq+Voh9ZAAAZvA8xPHic80jNyclXCM8vyknhAgAcMgQnuZAj3ZpSLQckQi9VfpQYWt+hefM=');
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
  console.log(out);
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
