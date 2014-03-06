var inflateStream = require('./inflate-stream.js');
var binary = require('bodec');
module.exports = function inflate(buffer) {
  var parts = [];
  var done = false;
  var push = inflateStream(onEmit, onUnused);
  push(null, buffer);
  push();
  if (!done) throw new Error("Missing input data");
  return binary.join(parts);

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
