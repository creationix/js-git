var Inflate = require('pako').Inflate;
var Binary = require('bodec').Binary;

// Byte oriented inflate stream.  Wrapper for pako's Inflate.
//
//   var inf = inflate();
//   inf.write(byte) -> more - Write a byte to inflate's state-machine.
//                             Returns true if more data is expected.
//   inf.recycle()           - Reset the internal state machine.
//   inf.flush() -> data     - Flush the output as a binary buffer.
//
module.exports = function inflateStream() {
  var inf = new Inflate();
  var b = new Uint8Array(1);
  var empty = new Binary(0);

  return {
    write: write,
    recycle: recycle,
    flush: Binary === Uint8Array ? flush : flushConvert
  };

  function write(byte) {
    b[0] = byte;
    inf.push(b);
    return !inf.ended;
  }

  function recycle() { inf = new Inflate(); }

  function flush() { return inf.result || empty; }

  function flushConvert() {
    return inf.result ? new Binary(inf.result) : empty;
  }
};
