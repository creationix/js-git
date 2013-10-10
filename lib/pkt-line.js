var binary = require('./binary.js');
var PACK = binary.build("PACK");

module.exports = {
  deframer: deframer,
  framer: framer,
  frame: frame
};

function deframer(emit) {
  var offset, length, data, string, type;
  var state = reset();
  var working = false;

  return function (chunk) {
    if (working) throw new Error("parser is not re-entrant");
    working = true;
    // Once in raw mode, pass all data through.
    if (!state) return emit("pack", chunk);

    for (var i = 0, l = chunk.length; i < l; i++) {
      state = state(chunk[i]);
      if (state) continue;
      emit("pack", binary.subarary(chunk, i));
      break;
    }
    working = false;
  };

  function reset() {
    offset = 4;
    length = 0;
    data = null;
    string = "";
    type = undefined;
    return $len;
  }

  function $len(byte) {
    var val = fromHexChar(byte);
    // If the byte isn't a hex char, it's bad input or it's raw PACK data.
    if (val === -1) {
      if (byte === PACK[0]) {
        offset = 1;
        return $maybeRaw;
      }
      throw new SyntaxError("Not a hex char: " + String.fromCharCode(byte));
    }
    length |= val << ((--offset) * 4);
    if (offset) return $len;
    if (length === 0) {
      offset = 4;
      emit("line", null);
      return $len;
    }
    if (length === 4) {
      offset = 4;
      emit("line", "");
      return $len;
    }
    if (length < 4) {
      throw new SyntaxError("Invalid length: " + length);
    }
    length -= 4;
    return $firstByte;
  }

  function $firstByte(byte) {
    if (byte === 1) {
      // PACK data in side-band
      length--;
      type = "pack";
      data = new Uint8Array(length);
      return $binary;
    }
    if (byte === 2) {
      length--;
      type = "progress";
      string = "";
      return $string;
    }
    if (byte === 3) {
      length--;
      type = "error";
      string = "";
      return $string;
    }
    type = "line";
    string = String.fromCharCode(byte);
    return $string;
  }

  function $binary(byte) {
    data[offset] = byte;
    if (++offset < length) return $binary;
    emit(type, data);
    return reset();
  }

  function $string(byte) {
    string += String.fromCharCode(byte);
    if (++offset < length) return $string;
    emit(type, string);
    return reset();
  }

  function $maybeRaw(byte) {
    if (offset === 4) return;
    if (byte === PACK[offset++]) return $maybeRaw;
    throw new SyntaxError("Invalid data in raw pack header");
  }
}

function framer(emit) {
  return function (type, value) {
    emit(frame(type, value));
  };
}

// Strings in line, progress, and error messages are assumed to be binary
// encoded.  If you want to send unicode data, please utf8 encode first.
function frame(type, value) {
  if (value === undefined && binary.is(type)) return type;
  if (type === "line") {
    if (value === null) return binary.build("0000");
    return binary.build(hexLen(value.length + 4) + value);
  }
  if (type === "pack") {
    return binary.build(hexLen(value.length + 5) + "\u0001", value);
  }
  if (type == "progress") {
    return binary.build(hexLen(value.length + 5) + "\u0002" + value);
  }
  if (type == "error") {
    return binary.build(hexLen(value.length + 5) + "\u0003" + value);
  }
  throw new Error("Unknown type: " + type);
}

// Given the code for a hex character, return it's value.
function fromHexChar(val) {
  return val >= 0x30 && val <  0x40 ? val - 0x30 :
         val >  0x60 && val <= 0x66 ? val - 0x57 : -1;
}

// Given a number, return a 4-digit hex number
function hexLen(length) {
  if (length > 0xffff) throw new Error("Length too large");
  return (length >> 12 & 0xf).toString(16) +
         (length >> 8 & 0xf).toString(16) +
         (length >> 4 & 0xf).toString(16) +
         (length & 0xf).toString(16);
}
