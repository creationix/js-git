"use strict";
var tcp = require('min-stream-node');
var pktLine = require('min-stream-pkt-line');
var helpers = require('min-stream-helpers');
var bops = require('bops');



function lsRemote(host, path) {

  tcp.connect(host, 3000, function (err, client) {
    if (err) throw err;

    console.log("Connected to %s, sending git-upload-pack request", host);
    helpers.run([
      client.source,
      pktLine.deframer,
      app,
      pktLine.framer,
      client.sink
    ]);

  });

  app.is = "min-stream-push-filter";
  function app(emit) {
    var state = "ref-discovery";
    var refs = {};
    var caps;
    var states = {
      "ref-discovery": function (message) {
        if (message === null) {
          console.log({refs:refs,caps:caps});
          var clientCaps = [
            // "multi_ack_detailed",
            // "side-band-64k",
            // "thin-pack",
            // "ofs-delta",
            "agent=js-git/0.0.0"
            // "agent=git/1.8.1.2"
          ];
          emit(null, pktLine.encode(["want", refs.HEAD].concat(clientCaps)));
          // emit(null, pktLine.encode(["want", refs["refs/heads/master"]]));
          emit(null, null);
          emit(null, pktLine.encode(["done"]));
          state = "pack";
          return;
        }
        message = pktLine.decode(message);
        if (message.caps) {
          caps = message.caps;
          delete message.caps;
        }
        refs[message[1]] = message[0];
      },
      "pack": function (message) {

      }
    };
    emit(null, pktLine.encode(["git-upload-pack", path], {host: host}, true));
    return function (err, item) {
      if (item === undefined) return emit(err);
      console.log(state, item);
      states[state](item);
    };
  }

}

function toString(value) {
  if (value === null) return null;
  return bops.to(value);
}

lsRemote("localhost", "/conquest.git");
