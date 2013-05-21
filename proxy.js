#!/usr/bin/env node
"use strict";

var argv = require('optimist')
  .usage("Create a logging tcp proxy")
  .demand("logfile")
  .options("remotehost", {
    default: "localhost"
  })
  .options("remoteport", {
    default: 9418
  })
  .options("localhost", {
    default: "localhost"
  })
  .options("localport", {
    default: 3000
  })
  .argv;


var tcp = require('min-stream-node/tcp.js');
var fs = require('min-stream-node/fs.js');
var msgpack = require('msgpack-js');
var leb128 = require('leb128-frame');
var helpers = require('min-stream-helpers');
var inspect = require('util').inspect;

if (argv.logfile.indexOf(".") < 0) {
  argv.logfile += ".msgpack";
}

tcp.createServer(argv.localhost, argv.localport, function (err, server) {
  if (err) {
    console.error(err.stack);
    return;
  }
  console.log("Local TCP proxy listening at %s:%s", argv.localhost, argv.localport);
  console.log(" - forwards to %s:%s", argv.remotehost, argv.remoteport);
  console.log(" - logs conversation with timing as %s", argv.logfile);
  helpers.sink(onConnection)(server.source);
});

function onConnection(err, local) {
  if (err) return console.error(err.stack);
  console.log("New local client");

  tcp.connect(argv.remotehost, argv.remoteport, function (err, remote) {
    if (err) return console.error(err.stack);
    console.log("Connected to remote server");

    fs.createWriteStream(argv.logfile, {}, function (err, log) {
      if (err) return console.error(err.stack);
      console.log("Log file opened");

      // Create stream generators since we want to split the two sources.
      var localGen = helpers.splitter(local.source);
      var remoteGen = helpers.splitter(remote.source);

      // Split out a copy of each stream and multiplex them together
      // Serialize and log to disk.
      var start = Date.now();
      helpers.run([
        helpers.joiner([
          helpers.mapToPull(function (item) {
            return [ "local", item ];
          })(localGen()),
          helpers.mapToPull(function (item) {
            return [ "remote", item ];
          })(remoteGen()),
        ]),
        function (item) {
          // Add in the current timestamp from stream start.
          item.push(Date.now() - start);
          console.log(inspect(item, {colors: true}));
          return msgpack.encode(item);
        },
        leb128.framer,
        log.sink
      ]);
      console.log("Logging conversation to disk");

      // The actual proxy connection
      remote.sink(localGen());
      local.sink(remoteGen());
      console.log("Wired up proxy connection");
    });
  });
}

