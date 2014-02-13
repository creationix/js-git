"use strict";

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
  return Buffer.isBuffer(value);
}

function create(length) {
  return new Buffer(length);
}

function join(chunks) {
  return Buffer.concat(chunks);
}

function slice(binary, start, end) {
  throw "TODO: Implement";
}

function copy(source, binary, offset) {
  throw "TODO: Implement";
}

// Like slice, but encode as a hex string
function toHex(binary, start, end) {
  throw "TODO: Implement";
}

// Like copy, but decode from a hex string
function fromHex(hex, binary, offset) {
  throw "TODO: Implement";
}

function toBase64(binary, start, end) {
  throw "TODO: Implement";
}

function fromBase64(base64, binary, offset) {
  throw "TODO: Implement";
}

function nibbleToCode(nibble) {
  throw "TODO: Implement";
}

function codeToNibble(code) {
  throw "TODO: Implement";
}

function toUnicode(binary, start, end) {
  throw "TODO: Implement";
}

function fromUnicode(unicode, binary, offset) {
  throw "TODO: Implement";
}

function decodeHex(hex) {
  throw "TODO: Implement";
}

function encodeHex(raw) {
  throw "TODO: Implement";
}

function decodeBase64(base64) {
  throw "TODO: Implement";
}

function encodeBase64(raw) {
  throw "TODO: Implement";
}

function decodeUtf8(utf8) {
  throw "TODO: Implement";
}

function encodeUtf8(unicode) {
  throw "TODO: Implement";
}

function toRaw(binary, start, end) {
  throw "TODO: Implement";
}

function fromRaw(raw, binary, offset) {
  throw "TODO: Implement";
}

function toArray(binary, start, end) {
  throw "TODO: Implement";
}

function fromArray(array, binary, offset) {
  throw "TODO: Implement";
}
