var inflateStream = require('./inflate-stream.js');
var inflate = require('./inflate.js');
var deflate = require('./deflate.js');
var sha1 = require('git-sha1');
var bodec = require('bodec');

var typeToNum = {
  commit: 1,
  tree: 2,
  blob: 3,
  tag: 4,
  "ofs-delta": 6,
  "ref-delta": 7
};
var numToType = {};
for (var type in typeToNum) {
  var num = typeToNum[type];
  numToType[num] = type;
}
exports.parseEntry = parseEntry;
function parseEntry(chunk) {
  var offset = 0;
  var byte = chunk[offset++];
  var type = numToType[(byte >> 4) & 0x7];
  var size = byte & 0xf;
  var left = 4;
  while (byte & 0x80) {
    byte = chunk[offset++];
    size |= (byte & 0x7f) << left;
    left += 7;
  }
  size = size >>> 0;
  var ref;
  if (type === "ref-delta") {
    ref = bodec.toHex(bodec.slice(chunk, offset, offset += 20));
  }
  else if (type === "ofs-delta") {
    byte = chunk[offset++];
    ref = byte & 0x7f;
    while (byte & 0x80) {
      byte = chunk[offset++];
      ref = ((ref + 1) << 7) | (byte & 0x7f);
    }
  }

  var body = inflate(bodec.slice(chunk, offset));
  if (body.length !== size) {
    throw new Error("Size mismatch");
  }
  var result = {
    type: type,
    body: body
  };
  if (typeof ref !== "undefined") {
    result.ref = ref;
  }
  return result;
}


exports.decodePack = decodePack;
function decodePack(emit) {

  var state = $pack;
  var sha1sum = sha1();
  var inf = inflateStream();

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
      if (!state) throw new Error("Unexpected extra bytes: " + bodec.slice(chunk, i));
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
    // console.log({type: type,length: length})
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
    var body = bodec.join(parts);
    if (body.length !== length) {
      throw new Error("Body length mismatch");
    }
    var item = {
      type: numToType[type],
      size: length,
      body: body,
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
    if (buf.length !== length) throw new Error("Length mismatch, expected " + length + " got " + buf.length);
    inf.recycle();
    if (buf.length) {
      parts.push(buf);
    }
    emitObject();
    // If this was all the objects, start calculating the sha1sum
    if (--num) return $header;
    sha1sum.update(bodec.slice(chunk, 0, i + 1));
    return $checksum;
  }

  // 20 byte checksum
  function $checksum(byte) {
    checksum += toHex(byte);
    if (++offset < 20) return $checksum;
    var actual = sha1sum.digest();
    if (checksum !== actual) throw new Error("Checksum mismatch: " + actual + " != " + checksum);
  }

}


exports.encodePack = encodePack;
function encodePack(emit) {
  var sha1sum = sha1();
  var left;
  return function (item) {
    if (item === undefined) {
      if (left !== 0) throw new Error("Some items were missing");
      return emit();
    }
    if (typeof item.num === "number") {
      if (left !== undefined) throw new Error("Header already sent");
      left = item.num;
      write(packHeader(item.num));
    }
    else if (typeof item.type === "string" && bodec.isBinary(item.body)) {
      // The header must be sent before items.
      if (typeof left !== "number") throw new Error("Headers not sent yet");

      // Make sure we haven't sent all the items already
      if (!left) throw new Error("All items already sent");

      // Send the item in packstream format
      write(packFrame(item));

      // Send the checksum after the last item
      if (!--left) {
        emit(bodec.fromHex(sha1sum.digest()));
      }
    }
    else {
      throw new Error("Invalid item");
    }
  };
  function write(chunk) {
    sha1sum.update(chunk);
    emit(chunk);
  }
}

function packHeader(length) {
  return bodec.fromArray([
    0x50, 0x41, 0x43, 0x4b, // PACK
    0, 0, 0, 2,             // version 2
    length >> 24,           // Num of objects
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff
  ]);
}

function packFrame(item) {
  var length = item.body.length;

  // write TYPE_AND_BASE128_SIZE
  var head = [(typeToNum[item.type] << 4) | (length & 0xf)];
  var i = 0;
  length >>= 4;
  while (length) {
    head[i++] |= 0x80;
    head[i] = length & 0x7f;
    length >>= 7;
  }

  if (typeof item.ref === "number") {
    // write BIG_ENDIAN_MODIFIED_BASE_128_NUMBER
    var offset = item.ref;
    // Calculate how many digits we need in base 128 and move the pointer
    i += Math.floor(Math.log(offset) / Math.log(0x80)) + 1;
    // Write the last digit
    head[i] = offset & 0x7f;
    // Then write the rest
    while (offset >>= 7) {
      head[--i] = 0x80 | (--offset & 0x7f);
    }
  }

  var parts = [bodec.fromArray(head)];
  if (typeof item.ref === "string") {
    parts.push(bodec.fromHex(item.ref));
  }
  parts.push(deflate(item.body));
  return bodec.join(parts);
}
