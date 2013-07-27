var zlib = require('zlib');

module.exports = inflate;
function inflate(buffer, callback) {
  if (!callback) return inflate.bind(this, buffer);
  zlib.inflate(buffer, callback);
}
