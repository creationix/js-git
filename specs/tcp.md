# TCP

This interface describes the TCP client interface used in the js-git project.

Streams are in [simple-stream][] format.

## connect(port, [host]) -> continuable&lt;socket>

Connect to a TCP server on `port` and `host` (defaulting to localhost).

Returns a continuable for a socket object containing a duplex simple-stream `{read, abort, sink}` representing the socket.

```js
tcp.connect(8080, function (err, socket) {
  if (err) throw err;
  // Make the server talk to itself
  socket.sink(socket)(function (err) {
    if (err) throw err;
    console.log("Connection ended");
  });
});
```

Or using [gen-run][] and [continuables][]:

```js
var socket = yield tcp.connect(8080);
yield socket.sink(socket);
```

# Concrete Implementations

 - [js-git-node-platform](https://github.com/creationix/js-git-node-platform) - Implementation for Node.JS

[simple-stream]: https://github.com/creationix/js-git/blob/master/specs/simple-stream.md
[gen-run]: https://github.com/creationix/gen-run
[continuables]: https://github.com/creationix/js-git/blob/master/specs/continuable.md
