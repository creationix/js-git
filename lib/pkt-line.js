var platform = require('./platform.js');
var bops = platform.require('bops');
var PACK = bops.from("PACK");

exports.deframer = deframer;
function deframer(emit) {
  var state = 0;
  var offset = 4;
  var length = 0;
  var data;

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
            emit("");
          }
          else if (length === 0) {
            offset = 4;
            emit(null);
          }
          else if (length > 4) {
            length -= 4;
            data = bops.create(length);
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
            emit(bops.subarray(data, 1));
          }
          else if (data[0] === 2) {
            emit({progress: bops.to(bops.subarray(data, 1))});
          }
          else if (data[0] === 3) {
            emit({error: bops.to(bops.subarray(data, 1))});
          }
          else {
            emit(bops.to(data));
          }
        }
      }
      else if (state === 2) {
        if (offset < 4 && byte === PACK[offset++]) {
          continue;
        }
        state = 3;
        emit(bops.join([PACK, bops.subarray(item, i)]));
        break;
      }
      else {
        throw new Error("pkt-line decoder in invalid state");
      }
    }
  };

}

exports.framer = framer;
function framer(emit) {
  return function (item) {
    if (item === undefined) return emit();
    if (item === null) {
      emit(bops.from("0000"));
      return;
    }
    if (typeof item === "string") {
      item = bops.from(item);
    }
    emit(bops.join([frameHead(item.length + 4), item]));
  };
}

exports.frameHead = frameHead;
function frameHead(length) {
  var buffer = bops.create(4);
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
