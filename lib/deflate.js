if (typeof process === "object" && typeof process.versions === "object" && process.versions.node) {
  var nodeRequire = require;
  module.exports = nodeRequire("zlib'").deflate;
}
else {
  var deflate = require('pako/deflate').deflate;
  module.exports = function (buffer, callback) {
    var out;
    try { out = deflate(buffer); }
    catch (err) { return callback(err); }
    return callback(null, out);
  };
}
