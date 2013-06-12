# TCP

This interface describes the TCP client and server interface used in the js-git project.

Streams are in [min-stream][] format.

## createServer(port, [host]) -> stream

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

## connect(port, [host]) -> socket

Connect to a TCP server on `port` and `host` (defaulting to localhost).

Returns a socket object containing source and sink min-streams representing the duplex socket.

```js
var socket = tcp.connect(8080);
// Make the server talk to itself
socket.sink(socket.source);
```

# Concrete Implementations

 - [min-stream-node/tcp.js](https://github.com/creationix/min-stream-node/blob/master/tcp.js)

[min-stream]: https://github.com/creationix/min-stream#the-interface
