# Min Stream

The min-stream system is an interface more than anything.  This has three main types: sources, filters, and sinks.

The goal of min-streams is to represent data streams (byte data and object data) using minimal abstraction and code.  It is easy enough to use directly, or layers can be built on top for fuller abstractions if desired.

All examples use `yield` to consume [continuables][], assuming generators with [gen-run][] wrapping, but can be used with ES5 code as well.

```js
// ES6 syntax
var target = yield fs.readlink("/path/to/symlink");

// ES5 syntax
fs.readlink("/path/to/symlink")(function (err, target) {
  if (err) throw err;
  // do something with target
});
```

## source(close, callback)

A source is a place where data comes from.  Since this is a pull-stream system, it's the place we pull data from.  It has the JavaScript signature:

```js
function read(close, callback) {
  // If close is truthy, that means to clean up any resources and close the stream
  // call callback with an END event when done.
  // Otherwise, get some data and when ready, callback(err, item)
  // DATA  is encoded as (falsy, item)
  // END   is encoded as (falsy, undefined) or (falsy) or ()
  // ERROR is encoded as (err, undefined)   or (err)
}
```

Sources are usually things like the readable end of TCP sockets and readable file streams.  They can really be anything that emits events in a stream though.

## filter(read) -> read

A filter is a function that accepts a source and returns a new transformed source.  This is where protocols are implemented.  It has the signature:

```js
function filter(read) {
  // Set up per-stream state here
  return function (close, callback) {
    // Handle per event logic here, reading from upstream `read` when needed.
    // Close is often just forwarded to the upstream `read`.
  };
}
```

## sink(source) -> continuable

A sink represents something like the writable end of a TCP socket or a writable file.  You can't write directly to it.  Rather, you hand it a source function and it pulls at the rate it can handle.  This way backpressure works automatically without having to deal with pause, resume, drain, and ready.

When given a source, the sinc returns a continuable.  When the continuable is activated, the source starts pulling from the source.

When the source either ends or has an error, the continuable for the sink resolves.

Sone sinks may output data in the continuable (like the buffered contents of the stream or a digested hash)

```js
// Usage is simple.
yield sink(source);
```

Or in the likely case you have a filter

```js
yield sink(
  filter(
    source
  )
);
```

## General Behavior

In a min-stream chain, errors can happen at any point and at any time.  There is a method to how well-behaved modules should propagate errors.  Here are some use cases.

### Friendly Infinite Stream

This is the simplest type of stream.  The source *always* calls the `callback(null, item)`, the filters pass the item through transformed in some way and the sink consumes repeatedly calling `read(null, callback)`

### Source Terminated Stream

If the source is a finite resource (like reading a file), then at some point the stream ends.  In this case it acts just like the friendly infinite stream, except when the source is done, it sends a `callback()` event down.  The filters pass it through and the sink stops reading and fulfills it's continuable.

Also if the source encounters an error (can't open the file for reading, permission denied, can't read offset of a pipe, etc...), it will send an end event encoded as `callback(err)` which gets forwarded down to the sink's continuable.

### Filter or Sink Terminated Stream

Filters and Sinks (anything that calls `read(...)`) can terminate the stream early.  In this case it needs to call `read(...)` with a truthy value.  The value of `true` means to close the stream, but there was no error.  Any other truthy value is interpreted to mean an error.

In either case (error or normal close), the `close` value will be forwarded by all filters till it reaches the source.  The source will clean up it's resources and callback.  If it was a non-error close, then it should respond with `callback(falsy)`.  If it was an error, it should echo the error message back down `callback(err)`.

When the filters see this coming back down, they keep forwarding it till it gets to the sink who reports it to it's continuable.

### Splitters

If a helper library splits a source stream into two or more streams, then upstream close events are reflected back (as if the junction was a source) for all but the last of the output streams.  Then the last output stream will act like a non-split chain and forward all the way back up to the source.

End and error downstream events are duplicated among all child streams.

### Joiners

If a helper library joins several sources into a single source, then closes it receives are duplicated upstream to all sources.

When the echo's come back, it's up to the junction's semantics as far as when to forward the end to it's children.  It could remember all the end codes and send the strongest when all have ended.

# Projects Implementing or Using Min Streams

 - [min-stream](https://github.com/creationix/min-stream) - Generic min-stream helpers
 - [min-fs](https://github.com/creationix/min-fs) - FS interface for node.js using min-streams
 - [min-tcp](https://github.com/creationix/min-tcp) - TCP interface for node.js using min-streams
 - [min-stream-node](https://github.com/creationix/min-stream-node) - Node stream to min-stream converter helpers.
