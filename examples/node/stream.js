exports.wrapStream = wrapStream;
function wrapStream(stream) {
  var out;
  if (stream.readable) {
    out = streamToSource(stream);
  }
  else {
    out = {};
  }
  if (stream.writable) {
    out.sink = streamToSink(stream);
  }
  return out;
}

exports.streamToSource = streamToSource;
function streamToSource(stream) {
  var dataQueue = [];
  var emit = null;

  stream.on('error', function (err) {
    dataQueue.push([err]);
    check();
  });

  stream.on('end', function () {
    dataQueue.push([]);
    check();
  });

  stream.on('readable', function () {
    var data = false;
    var chunk;
    while (chunk = stream.read()) {
      data = true;
      dataQueue.push([null, chunk]);
    }
    if (data) check();
  });

  function check() {
    if (emit && dataQueue.length) {
      var callback = emit;
      emit = null;
      callback.apply(null, dataQueue.shift());
    }

    if (dataQueue.length && !emit) {
      stream.pause();
    }
    else if (!dataQueue.length && emit) {
      stream.resume();
    }
  }

  return { read: streamRead, abort: streamAbort };

  function streamRead(callback) {
    if (dataQueue.length) {
      return callback.apply(null, dataQueue.shift());
    }
    if (emit) return new Error("Only one read at a time allowed.");
    emit = callback;
    check();
  }

  function streamAbort(callback) {
    stream.destroy();
    stream.on('close', callback);
  }

}

exports.streamToSink = streamToSink;
function streamToSink(writable) {
  return streamSink;
  function streamSink(stream, callback) {
    if (!callback) return streamSink.bind(this, stream);
    var sync;

    writable.on("drain", start);

    start();

    function start() {
      do {
        sync = undefined;
        stream.read(onRead);
        if (sync === undefined) sync = false;
      } while (sync);
    }

    function onRead(err, chunk) {
      if (chunk === undefined) {
        writable.end();
        writable.once("close", function () {
          callback(err);
        });
        return;
      }
      if (writable.write(chunk)){
        if (sync === undefined) sync = true;
        else start();
      }
    }
  }
}
