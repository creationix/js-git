var chars = "0123456789abcdef";

module.exports = function parseToHex(buffer, start, end) {
  var val = "";
  while (start < end) {
    var byte = buffer[start++];
    val += chars[byte >> 4] + chars[byte & 0xf];
  }
  return val;
};
