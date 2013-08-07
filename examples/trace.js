var inspect = require('util').inspect

var messages = {
  input: "\u2190",
  output: "\u2192"
};

module.exports = function (type, stream) {
  var message = messages[type];
  if (!message) return stream;
  return { read: traceRead, abort: stream.abort };
  function traceRead(callback) {
    stream.read(function (err, item) {
      if (err) return callback(err);
      console.log(message, inspect(item, {colors:true}));
      callback(null, item);
    });
  }
}
