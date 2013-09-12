
var types = {
  "1": "commit",
  "2": "tree",
  "3": "blob",
  "4": "tag",
  "6": "ofs-delta",
  "7": "ref-delta"
};

module.exports = function (platform) {
  var inflate = require('./inflate.js')(platform);
  var bops = platform.bops;
  var sha1 = platform.sha1;

  return function (emit) {

    var state = $pack;
    var sha1sum = sha1();
    var inf = inflate();

    var offset = 0;
    var position = 0;
    var version = 0x4b434150; // PACK reversed
    var num = 0;
    var type = 0;
    var length = 0;
    var ref = null;
    var checksum = "";
    var start = 0;
    var parts = [];


    return function (chunk) {
      if (chunk === undefined) {
        if (num || checksum.length < 40) throw new Error("Unexpected end of input stream");
        return emit();
      }

      for (var i = 0, l = chunk.length; i < l; i++) {
        // console.log([state, i, chunk[i].toString(16)]);
        if (!state) throw new Error("Unexpected extra bytes: " + bops.subarray(chunk, i));
        state = state(chunk[i], i, chunk);
        position++;
      }
      if (!state) return;
      if (state !== $checksum) sha1sum.update(chunk);
      var buff = inf.flush();
      if (buff.length) {
        parts.push(buff);
      }
    };

    // The first four bytes in a packfile are the bytes 'PACK'
    function $pack(byte) {
      if ((version & 0xff) === byte) {
        version >>>= 8;
        return version ? $pack : $version;
      }
      throw new Error("Invalid packfile header");
    }

    // The version is stored as an unsigned 32 integer in network byte order.
    // It must be version 2 or 3.
    function $version(byte) {
      version = (version << 8) | byte;
      if (++offset < 4) return $version;
      if (version >= 2 && version <= 3) {
        offset = 0;
        return $num;
      }
      throw new Error("Invalid version number " + num);
    }

    // The number of objects in this packfile is also stored as an unsigned 32 bit int.
    function $num(byte) {
      num = (num << 8) | byte;
      if (++offset < 4) return $num;
      offset = 0;
      emit({version: version, num: num});
      return $header;
    }

    // n-byte type and length (3-bit type, (n-1)*7+4-bit length)
    // CTTTSSSS
    // C is continue bit, TTT is type, S+ is length
    function $header(byte) {
      if (start === 0) start = position;
      type = byte >> 4 & 0x07;
      length = byte & 0x0f;
      if (byte & 0x80) {
        offset = 4;
        return $header2;
      }
      return afterHeader();
    }

    // Second state in the same header parsing.
    // CSSSSSSS*
    function $header2(byte) {
      length |= (byte & 0x7f) << offset;
      if (byte & 0x80) {
        offset += 7;
        return $header2;
      }
      return afterHeader();
    }

    // Common helper for finishing tiny and normal headers.
    function afterHeader() {
      offset = 0;
      if (type === 6) {
        ref = 0;
        return $ofsDelta;
      }
      if (type === 7) {
        ref = "";
        return $refDelta;
      }
      return $body;
    }

    // Big-endian modified base 128 number encoded ref offset
    function $ofsDelta(byte) {
      ref = byte & 0x7f;
      if (byte & 0x80) return $ofsDelta2;
      return $body;
    }

    function $ofsDelta2(byte) {
      ref = ((ref + 1) << 7) | (byte & 0x7f);
      if (byte & 0x80) return $ofsDelta2;
      return $body;
    }

    // 20 byte raw sha1 hash for ref
    function $refDelta(byte) {
      ref += toHex(byte);
      if (++offset < 20) return $refDelta;
      return $body;
    }

    // Common helper for generating 2-character hex numbers
    function toHex(num) {
      return num < 0x10 ? "0" + num.toString(16) : num.toString(16);
    }

    // Common helper for emitting all three object shapes
    function emitObject() {
      var item = {
        type: types[type],
        size: length,
        body: bops.join(parts),
        offset: start
      };
      if (ref) item.ref = ref;
      parts.length = 0;
      start = 0;
      offset = 0;
      type = 0;
      length = 0;
      ref = null;
      emit(item);
    }

    // Feed the deflated code to the inflate engine
    function $body(byte, i, chunk) {
      if (inf.write(byte)) return $body;
      var buf = inf.flush();
      inf.recycle();
      if (buf.length) {
        parts.push(buf);
      }
      emitObject();
      // If this was all the objects, start calculating the sha1sum
      if (--num) return $header;
      sha1sum.update(bops.subarray(chunk, 0, i + 1));
      return $checksum;
    }

    // 20 byte checksum
    function $checksum(byte) {
      checksum += toHex(byte);
      if (++offset < 20) return $checksum;
      var actual = sha1sum.digest();
      if (checksum !== actual) throw new Error("Checksum mismatch: " + actual + " != " + checksum);
    }

  };
};
