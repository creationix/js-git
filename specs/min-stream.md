## The Interface

The min-stream system is an interface more than anything.  This has three main types: sources, filters, and sinks.

### Source

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

### Filter

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

There are also technically two other filter types supported by the `chain` helper described later on.  They are regular map functions and push filters.  They have less power than normal pull filters; but are in many cases much easier to write.

### Sink

A sink represents something like the writable end of a TCP socket or a writable file.  You can't write directly to it.  Rather, you hand it a source function and it pulls at the rate it can handle.  This way backpressure works automatically without having to deal with pause, resume, drain, and ready.

```js
// Usage is simple.
sink(source);
```

Or in the likely case you have a filter

```js
sink(
  filter(
    source
  )
);
```
