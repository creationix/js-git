"use strict";

require('html5fs.js')(function (err, fs) {
  if (err) throw err;
  window.fs = fs;
  require('html5fsdb.js')(fs, "/.gitdb", function (err, db) {
    if (err) throw err;
    window.db = db;
  });
});

console.log(
  "Welcome to the js-git demo.\n" +
  "There are some global objects you can use to manupulate the sandbox.\n" +
  "They are `fs`, `git`, and `db`.\n" +
  "Use autocomplete to explore their capabilities"
);

var tcp = require('min-stream-chrome');
var helpers = require('min-stream-helpers');


tcp.createServer("127.0.0.1", 8080, function (client) {
  console.log("New client", client);
  client.sink(client.source);
  console.log("TCP echo server listening at localhost 8080");
});

window.httpGet = function (host) {
  window.helpers = helpers;
  tcp.connect(host, 80, function (err, socket) {
    if (err) throw err;
    var pipe = helpers.makePipe();
    socket.sink(pipe.read);
    helpers.consume(socket.source, function (err, item) {
      if (err) throw err;
      bufferToString(item, console.log.bind(console));
    });
    pipe.emit(null, "GET / HTTP/1.1\r\nHost: " + host + "\r\n\r\n");
  });
}

function bufferToString(buffer, callback) {
  var reader = new FileReader();
  reader.onload = function (evt) {
    callback(evt.target.result);
  };
  reader.readAsText(new Blob([new Uint8Array(buffer)]));
}

