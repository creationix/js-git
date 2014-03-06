var run = require('./run.js');
var bodec = require('bodec');

// The thing we mean to test.
var inflate = require('../lib/inflate.js');
var deflate = require('../lib/deflate.js');
var inflateStream = require('../lib/inflate-stream.js');

var bin = bodec.create(1024);
for (var i = 0; i < 1024; i++) {
  bin[i] = i >> 2 | i % 4 & 0x7f;
}

run([
  function testRoundTrip() {
    var deflated = deflate(bin);
    if (!bodec.isBinary(deflated)) {
      throw new Error("deflate output should be native binary");
    }
    var inflated = inflate(deflated);
    if (!bodec.isBinary(inflated)) {
      throw new Error("inflate output should be native binary");
    }
    if (bodec.toRaw(bin) !== bodec.toRaw(inflated)) {
      console.log([bin, inflated]);
      throw new Error("Problem with roundtrip");
    }
  },
  function testStream() {
    var done = false;
    var chunks = [];
    var deflated = deflate(bin);
    var push = inflateStream(onEmit, onUnused);
    for (var i = 0, l = deflated.length; i < l; i += 128) {
      push(null, bodec.slice(deflated, i, i + 128));
    }
    if (!done) throw new Error("Not finished");
    function onEmit(err, chunk) {
      if (err) throw err;
      if (chunk === undefined) {
        var inflated = bodec.join(chunks);
        if (bodec.toRaw(bin) !== bodec.toRaw(inflated)) {
          console.log([bin.length, inflated.length]);
          throw new Error("Problem with roundtrip");
        }
        done = true;
      }
      chunks.push(chunk);
    }
    function onUnused(unused) {
      if (unused[0].length) console.log("unused", unused);
    }
  }
]);
