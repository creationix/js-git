"use strict";

require('git-fs-html5')(function (err, fs) {
  if (err) throw err;
  window.fs = fs;
  require('git-db-fs')(fs, "/.gitdb", function (err, db) {
    if (err) throw err;
    window.db = db;
  });
});

console.log(
  "Welcome to the js-git demo.\n" +
  "There are some global objects you can use to manipulate the sandbox.\n" +
  "They are `fs`, `git`, and `db`.\n" +
  "Use auto-complete to explore their capabilities"
);

var tcp = require('min-stream-chrome');
var helpers = require('min-stream-helpers');
var http = require('min-stream-http-codec');

tcp.createServer("0.0.0.0", 3000, function (err, server) {
  if (err) throw err;
  console.log("HTTP Server Listening at localhost 3000");
  helpers.sink(onConnection)(server.source);
});

function onConnection(err, client) {
  if (client === undefined) {
    if (err) throw err;
    console.log("Server is now closed");
    return;
  }
  console.log("A new TCP client is connected");
  helpers.chain()
    .addPush(app)
    .pushWrap(http.decoder, http.encoder)
    .run(client.source, client.sink);
}

function app(respond) {
  return function (err, request) {
    console.log(request);
    respond(null, {
      statusCode: 200,
      headers: ["Content-Length", "12"]
    });
    respond(null, "Hello World\n");
    respond();
  };
}

