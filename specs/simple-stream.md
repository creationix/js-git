# Simple Streams

Simple streams are a modification to [min-streams][] that aren't quite as minimal, but should be much easier to use with only a slight change in definition.  After using min-streams for a while, the biggest issue is the confusion between the data channel and the close channel.  Also there is no structural type to tell consumers this is a stream.  It's just a function with little introspection.

A simple-stream is defined as an object with `.read(callback)` and `.stop(err, callback)` functions. These are functions, not methods.  This means that you don't have to worry about binding them to the stream object before calling them or using them as callbacks to other functions.

A nice side effect of this new design is that the `read` function is a continuable already.  Libraries that consume generators like [gen-run][] can yield on read directly for easy stream consumption.

```js
var stream = {
  read: function (callback) { ... },
  stop: function (err, callback) { ... }
};

run(function* () {
  var parts = [];
  var part;
  while (part = yield stream.read) {
    parts.push(part);
  }
  return parts;
});
```

## read(callback)

Read the next chunk from the stream.  The callback will be called with `(err, item)` when the data is available.  This may be right away, even before read returns, or it may be in a later event loop in the case the data is not there yet.

There are two main kinds of events encoded in the callback.

If the `item` argument is `undefined` then it's the end of the stream.  If `err` is truthy then it was an error that's ending the stream, if it's falsy, then it's the natural end to the stream.

If `item` is anything else, then it's the value.  `err` *should* always be falsy in this case to comform to the spec.

## stop(err, [callback])

Tell upstream to stop the stream.  It should clean up any resources and call the optional callback (if given) when done.  If you're stopping because of an error, pass some truthy value to `err`.  If not pass a falsy value to simply notify that you're not interested in the stream anymore.

## sink(stream)

There are no writable streams, but sinks are functions that consume stream objects and pull from them.  Usually these are plain bare functions, but if you have a duplex stream to encode, simply create an object with `{read, stop, sink}`.  For example a TCP server implementing this interface that acts as an echo server would look like:

```js
tcp.createServer(8080, function (socket) {
  socket.sink(socket);
});
```

## pullTransform(stream) -> stream

A normal pull filter is a function that accepts a stream (`{read, stop}`) and returns a new stream.  This is used to implement things like protocol codecs and application logic in a network program.

## pushTransform(emit) -> emit

For protocols where you don't care about the `stop` signal (most transform filters will just forward it onward in all cases) and you don't have a 1:1 relationship between input events and output events, this is perfect.

```js
// A simple transform filter that accepts sentances and outputs words
function words(emit) {
  return function (err, item) {
    // In case of end events (error or plain), forward to downstream.
    if (item === undefined) return emit(err);
    item.split(" ").forEach(function (word) {
      emit(null, word);
    });
  };
}
```

A generic library can be used to convert this format to a pullFilter and handle back-pressure and queueing for you so you can focus on the logic of your protocol.  Also several push filters can be layered directly before finally converting the last one to a pull style.

[min-streams]: https://github.com/creationix/min-stream
[gen-run]: https://github.com/creationix/gen-run
