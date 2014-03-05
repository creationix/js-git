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
  function testRoundTrip(end) {
    deflate(bin, function (err, deflated) {
      if (err) return end(err);
      inflate(deflated, function (err, inflated) {
        if (err) return end(err);
        if (bodec.toRaw(bin) !== bodec.toRaw(inflated)) {
          console.log([bin, inflated]);
          return end(new Error("Problem with roundtrip"));
        }
        end();
      });
    });
  },
  function testStream(end) {
    var chunks = [];
    deflate(bin, function (err, deflated) {
      if (err) return end(err);
      var push = inflateStream(onEmit, onUnused);
      for (var i = 0, l = deflated.length; i < l; i += 128) {
        push(null, bodec.slice(deflated, i, i + 128));
      }
    });
    function onEmit(err, chunk) {
      if (err) return end(err);
      if (chunk === undefined) {
        var inflated = bodec.join(chunks);
        if (bodec.toRaw(bin) !== bodec.toRaw(inflated)) {
          console.log([bin.length, inflated.length]);
          return end(new Error("Problem with roundtrip"));
        }
        return end();
      }
      chunks.push(chunk);
    }
    function onUnused(unused) {
      if (unused[0].length) console.log("unused", unused);
    }
  }
]);
