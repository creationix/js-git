module.exports = function (platform) {

  var inflate = require('./min.js')(platform);
  var bops = platform.bops;

  // Wrapper for proposed new API to inflate:
  //
  //   var inf = inflate();
  //   inf.write(byte) -> more - Write a byte to inflate's state-machine.
  //                             Returns true if more data is expected.
  //   inf.recycle()           - Reset the internal state machine.
  //   inf.flush() -> data     - Flush the output as a binary buffer.
  //
  // This is quite slow, but could be made fast if baked into inflate itself.
  return function () {
    var push = inflate(onEmit, onUnused);
    var more = true;
    var chunks = [];
    var b = bops.create(1);

    return { write: write, recycle: recycle, flush: flush };

    function write(byte) {
      b[0] = byte;
      push(null, b);
      return more;
    }

    function recycle() {
      push.recycle();
      more = true;
    }

    function flush() {
      var buffer = bops.join(chunks);
      chunks.length = 0;
      return buffer;
    }

    function onEmit(err, item) {
      if (err) throw err;
      if (item === undefined) {
        // console.log("onEnd");
        more = false;
        return;
      }
      chunks.push(item);
    }

    function onUnused(chunks) {
      // console.log("onUnused", chunks);
      more = false;
    }
  };

};