module.exports = demux;

function demux(stream, channels) {
  var queues = {};
  var emits = {};
  var streams = {};
  var reading = false;

  channels.forEach(function (name) {
    var queue = queues[name] = [];
    emits[name] = null;
    streams[name] = { read: demuxRead, abort: stream.abort };

    function demuxRead(callback) {
      if (queue.length) {
        return callback.apply(null, queue.shift());
      }
      if (emits[name]) return callback(new Error("Only one read at a time"));
      emits[name] = callback;
      check(name);
    }

  });

  return streams;

  function check(name) {
    var queue = queues[name];
    var emit = emits[name];
    if (emit && queue.length) {
      emits[name] = null;
      emit.apply(null, queue.shift());
    }

    if (reading) return;

    // If anyone is waiting on data, we should get more from upstream.
    var isWaiting = false;
    for (var i = 0, l = channels.length; i < l; i++) {
      if (emits[channels[i]]) {
        isWaiting = true;
        break;
      }
    }
    if (!isWaiting) return;

    reading = true;
    stream.read(onRead);
  }

  function onRead(err, item) {
    reading = false;
    if (item === undefined) {
      return channels.forEach(function (name) {
        queues[name].push([err]);
        check(name);
      });
    }
    var name = item[0];
    item = item[1];
    queues[name].push([null, item]);
    check(name);
  }

}
