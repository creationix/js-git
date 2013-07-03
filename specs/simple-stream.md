# Simple Streams

This is a common stream interface for use in any JavaScript environment.  It supports back-pressure and values over time in a non-blocking fasion.

The core interface to this spec is the stream object, defined as:

```js
var stream = {
  read: function (callback) {
    // callback(err, item)
  },
  abort: function (callback) {
    // callback(err)
  }
};
```

This is a pull stream meaning that no data flows till the consumer asks for it.  Thus there is no problem with data events getting emitted when there is nobody to handle them.  Also it prevents excessive buffering of data when the consumer is slower than the producer.

## read(callback)

The `read` function is the primary interface in a stream.  The consumer will repeatedly call `read` passing in `callback(err, item)` to get the next item in the stream.

If there are no more items or there was an error upstream, the callback will be called with `item === undefined`.

## abort(callback)

Sometimes you want to tell the upstream source that you are no longer interested in reading more data.  Call this to let the source know it can close things and clean up it's resources.  You may still get 0 or more data events that are pending in the pipeline after calling `abort`.

```js
// Create an infinite stream
function count(ms) {
  var num = 0;
  var closed = false;
  return { read: read, abort: abort };
  
  function read(callback) {
    if (closed) return callback();
    var i = num++;
    setTimeout(function () {
      callback(null, i)
    }, ms);
  }
  
  function abort(callback) {
    closed = true;
    callback();
  }
}
```

# Related Interfaces

That's it for the simple-streams spec.  There are however several related interfaces that are commonly used to work with streams.

The first three are classes of functions that consume streams, return streams or both.  They are are known as `source`, `filter`, and `sink`.

### source([args...]) -> stream

A source is a function that accepts 0 or more config arguments and returns a new source.

```js
var input = fs.readStream("myFile");
```

### filter(stream, [args...]) -> stream

A filter transforms one stream into another.  This is used for everything from protocols to applications to framer/deframers, to format codecs.

In most programs you'll be using a lot of filters.  This is where work happens.

```js
tcp.createServer(8080, connectionFilter);
function connectionFilter(socket) {
  // socket is a simple stream with { read, abort }
  // return it back to implement an echo server.
  return socket;
}
```

A filter that accepts buffers and outputs uppercase strings would look like:

```js
function toUpper(stream) {
  // Return a new stream with read replaced.
  return { read: read, abort: stream.abort };
  
  function read(callback) {
    stream.read(function (err, item) {
      // Forward end and error events through as-is.
      if (item === undefined) return callback(err);
      callback(null, item.toString().toUpperCase());
    });
  }
}
```

This could be used to create a file stream that emits uppercase values.

```js
var input = toUpper(fs.readStream("myfile.txt"));
```

### sink(stream, [args...]) -> continuable

A sink is any function that consumes a stream.  It can have other config options as well.  It's best to return a continuable so that errors have a place to be reported to.  Also the continuable will resolve when the stream is done.

Here is a sample that consumes a stream emitting the array of items or the error.

```js
// consume(stream<item>) -> continuable<items>
function consume(stream) {
  // Model as continuable
  var items = []
  var callback;
  // return the continuable
  return function (cb) {
    callback = cb;
    stream.read(onRead);
  };

  function onRead(err, item) {
    if (item === undefined) {
      return callback(err, items);
    }
    items.push(item);
    stream.read(onRead);
  }
}
```
