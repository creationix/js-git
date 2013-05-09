"use strict";
var tcp = require('min-stream-node');
var helpers = require('min-stream-helpers');

tcp.createServer("0.0.0.0", 3000, onListening);

function onListening(err, server) {
  if (err) throw err;
  console.log("TCP Echo Server listening at", server.address());
  helpers.sink(onConnection)(server.source);
}

function onConnection(err, client) {
  if (client === undefined) {
    if (err) throw err;
    console.log("SERVER STREAM END");
    return;
  }
  console.log("A new client");
  client.sink(client.source);
}
