var pushToPull = require('push-to-pull');
var deframer = pushToPull(require('./pkt-line.js').deframer);
var framer = pushToPull(require('./pkt-line.js').framer);
var demux = require('./demux.js');
var writable = require('./writable.js');

module.exports = function (socket, machine, callback) {

  var line = demux(deframer(socket), ["line"]).line;
  var write = writable(socket.abort);

  var state = machine(write, function (result) {
    finish(null, result);
  });

  line.read(onRead);
  function onRead(err, item) {
    if (err) return finish(err);
    try {
      state = state(item);
    }
    catch (err) {
      return finish(err);
    }
    if (state) line.read(onRead);
  }
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
