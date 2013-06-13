# TCP

This interface describes the TCP client and server interface used in the js-git project.

Streams are in [min-stream][] format.

## createServer(port, [host]) -> stream<socket>

Create a TCP server listening on `port` and `host` (defaulting to localhost).  The stream is a connection stream.  It emits an event every time a new client connects.

The connection events in the stream are objects that contain a socket source and sink representing the duplex TCP socket.

```js
var server = tcp.createServer(8080);
// Get the first client and make them talk to themselves.
server(null, function (err, client) {
  if (err) throw err;
  client.sink(client.source);
  
  // Then close the server to disallow more connections
  server(true, function (err) {
    if (err) throw err;
    console.log("Server closed");
  });
});
```

## connect(port, [host]) -> continuable<socket>

Connect to a TCP server on `port` and `host` (defaulting to localhost).

Returns a continuable for a socket object containing source and sink min-streams representing the duplex socket.

```js
tcp.connect(8080)(function (err, socket) {
  if (err) throw err;
  // Make the server talk to itself
  socket.sink(socket.source)(function (err) {
    if (err) throw err;
    console.log("Connection ended");
  });
});
```

Or using [gen-run][] and [continuables][]:

```js
var socket = yield tcp.connect(8080);
yield socket.sink(socket.source);
```

# Concrete Implementations

 - [min-tcp](https://github.com/creationix/min-tcp) - Implementation for Node.JS

[min-stream]: https://github.com/creationix/js-git/blob/master/specs/min-stream.md
[gen-run]: https://github.com/creationix/gen-run
[continuables]: https://github.com/creationix/js-git/blob/master/specs/continuable.md
