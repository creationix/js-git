if (typeof process === "object" && typeof process.versions === "object" && process.versions.node) {
  var nodeRequire = require;
  module.exports = nodeRequire("zlib").inflate;
}
else {
  var inflateStream = require('./inflate-stream.js');
  var binary = require('bodec');
  module.exports = function inflate(buffer, callback) {
    var out;
    try {
      var parts = [];
      var done = false;
      var push = inflateStream(onEmit, onUnused);
      push(null, buffer);
      push();
      if (!done) throw new Error("Missing input data");
      out = binary.join(parts);
    } catch (err) {
      return callback(err);
    }
    callback(null, out);

    function onEmit(err, chunk) {
      if (err) throw err;
      if (chunk) parts.push(chunk);
      else done = true;
    }

    function onUnused(extra) {
      if (extra && extra.length && extra[0].length) {
        throw new Error("Too much input data");
      }
    }
  };
}
