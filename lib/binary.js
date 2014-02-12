"use strict";
/*global escape, unescape*/

// This file must be served with UTF-8 encoding for the utf8 codec to work.
module.exports = {
  // Utility functions
  isBinary: isBinary,
  create: create,
  join: join,

  // Binary input and output
  copy: copy,
  slice: slice,

  // String input and output
  toRaw: toRaw,
  fromRaw: fromRaw,
  toUnicode: toUnicode,
  fromUnicode: fromUnicode,
  toHex: toHex,
  fromHex: fromHex,
  toBase64: toBase64,
  fromBase64: fromBase64,

  // Array input and output
  toArray: toArray,
  fromArray: fromArray,

  // Raw <-> Hex-encoded codec
  decodeHex: decodeHex,
  encodeHex: encodeHex,

  decodeBase64: decodeBase64,
  encodeBase64: encodeBase64,

  // Unicode <-> Utf8-encoded-raw codec
  encodeUtf8: encodeUtf8,
  decodeUtf8: decodeUtf8,

  // Hex <-> Nibble codec
  nibbleToCode: nibbleToCode,
  codeToNibble: codeToNibble
};

function isBinary(value) {
  return value &&
      typeof value === "object" &&
      value.constructor.name === "Uint8Array";
}

function create(length) {
  return new Uint8Array(length);
}

function join(chunks) {
  var length = chunks.length;
  var total = 0;
  for (var i = 0; i < length; i++) {
    total += chunks[i].length;
  }
  var binary = create(total);
  var offset = 0;
  for (i = 0; i < length; i++) {
    var chunk = chunks[i];
    copy(chunk, binary, offset);
    offset += chunk.length;
  }
  return binary;
}

function slice(binary, start, end) {
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  return binary.subarray(start, end);
}

function copy(source, binary, offset) {
  var length = source.length;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  for (var i = 0; i < length; i++) {
    binary[i + offset] = source[i];
  }
  return binary;
}

// Like slice, but encode as a hex string
function toHex(binary, start, end) {
  var hex = "";
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  for (var i = start; i < end; i++) {
    var byte = binary[i];
    hex += String.fromCharCode(nibbleToCode(byte >> 4)) +
           String.fromCharCode(nibbleToCode(byte & 0xf));
  }
  return hex;
}

// Like copy, but decode from a hex string
function fromHex(hex, binary, offset) {
  var length = hex.length / 2;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  var j = 0;
  for (var i = 0; i < length; i++) {
    binary[offset + i] = (codeToNibble(hex.charCodeAt(j++)) << 4)
                       |  codeToNibble(hex.charCodeAt(j++));
  }
  return binary;
}

function toBase64(binary, start, end) {
  return btoa(toRaw(binary, start, end));
}

function fromBase64(base64, binary, offset) {
  return fromRaw(atob(base64), binary, offset);
}

function nibbleToCode(nibble) {
  nibble |= 0;
  return (nibble + (nibble < 10 ? 0x30 : 0x57))|0;
}

function codeToNibble(code) {
  code |= 0;
  return (code - ((code & 0x40) ? 0x57 : 0x30))|0;
}

function toUnicode(binary, start, end) {
  return decodeUtf8(toRaw(binary, start, end));
}

function fromUnicode(unicode, binary, offset) {
  return fromRaw(encodeUtf8(unicode), binary, offset);
}

function decodeHex(hex) {
  var j = 0, l = hex.length;
  var raw = "";
  while (j < l) {
    raw += String.fromCharCode(
       (codeToNibble(hex.charCodeAt(j++)) << 4)
      | codeToNibble(hex.charCodeAt(j++))
    );
  }
  return raw;
}

function encodeHex(raw) {
  var hex = "";
  var length = raw.length;
  for (var i = 0; i < length; i++) {
    var byte = raw.charCodeAt(i);
    hex += String.fromCharCode(nibbleToCode(byte >> 4)) +
           String.fromCharCode(nibbleToCode(byte & 0xf));
  }
  return hex;
}

function decodeBase64(base64) {
  return atob(base64);
}

function encodeBase64(raw) {
  return btoa(raw);
}

function decodeUtf8(utf8) {
  return decodeURIComponent(escape(utf8));
}

function encodeUtf8(unicode) {
  return unescape(encodeURIComponent(unicode));
}

function toRaw(binary, start, end) {
  var raw = "";
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  for (var i = start; i < end; i++) {
    raw += String.fromCharCode(binary[i]);
  }
  return raw;
}

function fromRaw(raw, binary, offset) {
  var length = raw.length;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  for (var i = 0; i < length; i++) {
    binary[offset + i] = raw.charCodeAt(i);
  }
  return binary;
}

function toArray(binary, start, end) {
  if (end === undefined) {
    end = binary.length;
    if (start === undefined) start = 0;
  }
  var length = end - start;
  var array = new Array(length);
  for (var i = 0; i < length; i++) {
    array[i] = binary[i + start];
  }
  return array;
}

function fromArray(array, binary, offset) {
  var length = array.length;
  if (offset === undefined) {
    offset = 0;
    if (binary === undefined) binary = create(length);
  }
  for (var i = 0; i < length; i++) {
    binary[offset + i] = array[i];
  }
  return binary;
}
