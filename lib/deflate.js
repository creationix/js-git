var zlib = require('zlib');
module.exports = function deflate(buffer, callback) {
  return zlib.deflate(buffer, callback);
};
// TODO: make this work in the browser too.