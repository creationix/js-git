var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('./pkt-line.js').deframer);
var framer = pushToPull(require('./pkt-line.js').framer);
var writable = require('./writable.js');

module.exports = function (socket, machine, callback) {

  var stream = deframer(socket);
  // stream = trace("\u2190", stream);
  var write = writable(socket.abort);

  var state = machine(write, function (result) {
    finish(null, result);
  });

  stream.read(onRead);
  function onRead(err, item) {
    if (err) return finish(err);
    try {
      state = state(item);
    }
    catch (err) {
      return finish(err);
    }
    if (state) stream.read(onRead);
  }

  // write = trace("\u2192", write);
  socket.sink(framer(write), function (err) {
    if (err) return finish(err);
  });

  var done = false;
  function finish(err, result) {
    if (done) return;
    done = true;
    callback(err, result);
  }
};

var inspect = require('util').inspect
function trace(message, stream) {
  return { read: traceRead, abort: stream.abort };
  function traceRead(callback) {
    stream.read(function (err, item) {
      if (err) return callback(err);
      console.log(message, inspect(item, {colors:true}));
      callback(null, item);
    });
  }
}
