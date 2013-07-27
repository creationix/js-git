var zlib = require('zlib');

module.exports = deflate;
function deflate(buffer, callback) {
  if (!callback) return deflate.bind(this, buffer);
  zlib.deflate(buffer, callback);
}
