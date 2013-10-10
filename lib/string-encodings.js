/*global escape, unescape*/
// NOTE: This JS file *must* be served with a utf8 mime-type.

module.exports = {
  utf8: {
    encode: utf8Encode,
    decode: utf8Decode,
  },
  hex: {
    encode: hexEncode,
    decode: hexDecode,
  },
  // base64: {
  //   encode: base64Encode,
  //   decode: base64Decode,
  // },
};

function utf8Encode(string) {
  return unescape(encodeURIComponent(string));
}

function utf8Decode(string) {
  return decodeURIComponent(escape(string));
}

function hexEncode(string) {
  var out = "";
  for (var i = 0, l = string.length; i < l; i++) {
    var code = string.charCodeAt(i) & 0xff;
    if (code < 0x10) out += "0" + code.toString(16);
    out += code.toString(16);
  }
  return out;
}

function hexDecode(string) {
  var out = "";
  for (var i = 0, l = string.length; i < l; i += 2) {
    var code = parseInt(string.substr(i, 2), 16);
    out += String.fromCharCode(code & 0xff);
  }
  return out;
}
