module.exports = function parseAscii(buffer, start, end) {
  var val = "";
  while (start < end) {
    val += String.fromCharCode(buffer[start++]);
  }
  return val;
};
