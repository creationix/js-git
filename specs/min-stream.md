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

### sink(source) -> continuable

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
