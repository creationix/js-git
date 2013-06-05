"use strict";
var bops = require('bops');

var PACK = bops.from("PACK");
exports.deframer = function (emit) {
  var state = 0;
  var offset = 4;
  var length = 0;
  var data;
  var fn = function (err, item) {

    // Forward the EOS marker
    if (item === undefined) return emit(err);

    // Once we're in pack mode, everything goes straight through
    if (state === 3) return emit(null, ["pack", item]);

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
          return emit(new SyntaxError("Not a hex char: " + String.fromCharCode(byte)));
        }
        length |= val << ((--offset) * 4);
        if (offset === 0) {
          if (length === 4) {
            offset = 4;
            emit(null, ["line", ""]);
          }
          else if (length === 0) {
            offset = 4;
            emit(null, ["line", null]);
          }
          else if (length > 4) {
            length -= 4;
            data = bops.create(length);
            state = 1;
          }
          else {
            state = -1;
            return emit(new SyntaxError("Invalid length: " + length));
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
            emit(null, ["pack", bops.subarray(data, 1)]);
          }
          else if (data[0] === 2) {
            emit(null, ["progress", bops.to(bops.subarray(data, 1))]);
          }
          else if (data[0] === 3) {
            emit(null, ["error", bops.to(bops.subarray(data, 1))]);
          }
          else {
            emit(null, ["line", bops.to(data)]);
          }
        }
      }
      else if (state === 2) {
        if (offset < 4 && byte === PACK[offset++]) {
          continue;
        }
        state = 3;
        emit(null, ["pack", bops.join([PACK, bops.subarray(item, i)])]);
        break;
      }
      else {
        emit(new Error("pkt-line decoder in invalid state"));
      }
    }
  };
  fn.is = "min-stream-write";
  return fn;
};
exports.deframer.is = "min-stream-push-filter";

exports.framer = function (emit) {
  var packMode = false;
  var fn = function (err, item) {
    if (item === undefined) return emit(err);
    if (typeof item === "string") item = bops.from(item);
    if (packMode) return emit(null, item);
    if (item === null) return emit(null, bops.from("0000"));
    if (item === true) {
      packMode = true;
      return;
    }
    var length = item.length + 4;
    var buf = bops.create(length);
    buf[0] = toHexChar(length >>> 12);
    buf[1] = toHexChar((length >>> 8) & 0xf);
    buf[2] = toHexChar((length >>> 4) & 0xf);
    buf[3] = toHexChar(length & 0xf);
    for (var i = 4; i < length; i++) {
      buf[i] = item[i - 4];
    }
    emit(null, buf);
  };
  fn.is = "min-stream-write";
  return fn;
};
exports.framer.is = "min-stream-push-filter";

function fromHexChar(val) {
  return (val >= 0x30 && val <  0x40) ? val - 0x30 :
        ((val >  0x60 && val <= 0x66) ? val - 0x57 : -1);
}

function toHexChar(val) {
  return val < 0x0a ? val + 0x30 : val + 0x57;
}
