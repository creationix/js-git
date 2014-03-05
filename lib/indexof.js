module.exports = function indexOf(buffer, byte, i) {
  i |= 0;
  var length = buffer.length;
  for (;;i++) {
    if (i >= length) return -1;
    if (buffer[i] === byte) return i;
  }
};
