var Inflate = require('pako').Inflate;
var Binary = require('bodec').Binary;
exports = function inflateStream() {
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
