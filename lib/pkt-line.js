"use strict";

var bodec = require('bodec');
var PACK = bodec.fromRaw("PACK");

module.exports = {
  deframer: deframer,
  framer: framer
};

function deframer(emit) {
  var state = 0;
  var offset = 4;
  var length = 0;
  var data;
  var more = true;

  return function (item) {

    // Forward the EOS marker
    if (item === undefined) return emit();

    // Once we're in pack mode, everything goes straight through
    if (state === 3) return emit(item);

    // Otherwise parse the data using a state machine.
    for (var i = 0, l = item.length; i < l; i++) {
      var byte = item[i];
      if (state === 0) {
        var val = fromHexChar(byte);
        if (val === -1) {
          if (byte === PACK[0]) {
            offset = 1;
            state = 2;
            continue;
          }
          state = -1;
          throw new SyntaxError("Not a hex char: " + String.fromCharCode(byte));
        }
        length |= val << ((--offset) * 4);
        if (offset === 0) {
          if (length === 4) {
            offset = 4;
            more = emit("");
          }
          else if (length === 0) {
            offset = 4;
            more = emit(null);
          }
          else if (length > 4) {
            length -= 4;
            data = bodec.create(length);
            state = 1;
          }
          else {
            state = -1;
            throw new SyntaxError("Invalid length: " + length);
          }
        }
      }
      else if (state === 1) {
        data[offset++] = byte;
        if (offset === length) {
          offset = 4;
          state = 0;
          length = 0;
          if (data[0] === 1) {
            more = emit(bodec.slice(data, 1));
          }
          else if (data[0] === 2) {
            more = emit({progress: bodec.toUnicode(data, 1)});
          }
          else if (data[0] === 3) {
            more = emit({error: bodec.toUnicode(data, 1)});
          }
          else {
            more = emit(bodec.toUnicode(data).trim());
          }
        }
      }
      else if (state === 2) {
        if (offset < 4 && byte === PACK[offset++]) {
          continue;
        }
        state = 3;
        more = emit(bodec.join([PACK, bodec.subarray(item, i)]));
        break;
      }
      else {
        throw new Error("pkt-line decoder in invalid state");
      }
    }

    return more;
  };

}

function framer(emit) {
  return function (item) {
    if (item === undefined) return emit();
    if (item === null) {
      return emit(bodec.fromRaw("0000"));
    }
    if (typeof item === "string") {
      item = bodec.fromUnicode(item);
    }
    return emit(bodec.join([frameHead(item.length + 4), item]));
  };
}

function frameHead(length) {
  var buffer = bodec.create(4);
  buffer[0] = toHexChar(length >>> 12);
  buffer[1] = toHexChar((length >>> 8) & 0xf);
  buffer[2] = toHexChar((length >>> 4) & 0xf);
  buffer[3] = toHexChar(length & 0xf);
  return buffer;
}

function fromHexChar(val) {
  return (val >= 0x30 && val <  0x40) ? val - 0x30 :
        ((val >  0x60 && val <= 0x66) ? val - 0x57 : -1);
}

function toHexChar(val) {
  return val < 0x0a ? val + 0x30 : val + 0x57;
}
