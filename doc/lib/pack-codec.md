# Pack Codec

This module implements a codec for packfile streams used in the git network
protocols as well as the on-disk packfile format.

These are a sync stream transforms.  It accepts an emit function and returns a
write function.  Both of these have the same interface.  You signal `end` to the
input side by writing undefined (or nothing) and when emit gets called with
undefined that is `end` on the output.

Since this is sync, errors are simply thrown.  If you want to use this in the
context of an async stream with back-pressure, it's up to the consumer to handle
exceptions and write to the input at the correct rate.  Basically to implement
back-pressure, you only need to keep writing values to the input till enough
data comes out the output.  It's sync so by the time `write()` returns, `emit()`
will have been called as many times as it ever will (without more writes).

Here is an example of using the decodePack in a node push stream that ignores
backpressure.

```js
var decodePack = require('js-git/lib/pack-codec').decodePack;

var write = decodePack(onItem);
stream.on("data", write);
stream.on("end", write);
var meta;
function onItem(item) {
  if (item === undefined) {
    // END of Stream
  }
  else if (meta === undefined) {
    meta = item;
  }
  else {
    console.log(item);
  }
}
```

The first output is the meta object:

```js
{
  version: 2
  num: num-of-objects,
}
```

## codec.decodePack(emit) -> write

Input in this is the raw buffer chunks in the packstream.  The chunks can be
broken up at any point so this is ideal for streaming from a disk or network.


Version is the git pack protocol version, and num is the number of objects that
will be in this stream.

All output objects after this will be raw git objects.

```js
{
  type: type,
  size: buffer-size,
  body: raw-buffer,
  offset: offset-in-stream,
  [ref: number-or-hash]
}
```

There are two extra types here that aren't seen elsewhere.  They are `ofs-delta`
and `ref-delta`.  In both cases, these are a diff that applies on top of another
object in the stream.  The different is `ofs-delta` stores a number in `ref`
that is the number of bytes to go back in the stream to find the base object.
But `ref-delta` includes the full hash of it's base object.


## codec.encodePack(emit) -> write

This is the reverse.  In fact, if you fed this the output from `decodePack`,
it's output should match exactly the original stream.

The objects don't need as much data as the parser outputs.  In specefic, the meta
object only need contain:

```js
{ num: num-of-objects }
```

And the items only need contain:

```js
{
  type: type,
  body: raw-buffer,
  [ref: number-or-hash]
}
```
