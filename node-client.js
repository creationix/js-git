"use strict";
var tcp = require('min-stream-node');
var pktLine = require('min-stream-pkt-line');
var helpers = require('min-stream-helpers');
var bops = require('bops');



function lsRemote(host, path) {

  tcp.connect(host, 9418, function (err, client) {
    if (err) throw err;

    console.log("Connected to %s, sending git-upload-pack request", host);
    helpers.chain()
      .addPush(app)
      .pushWrap(pktLine.deframer, pktLine.framer)
      .run(client.source, client.sink);

  });

  function app(emit) {
    var state = "ref-discovery";
    var states = {
      "ref-discovery": function (message) {
        if (message === null) {
          console.log("TODO: handle next state");
          return;
        }
        message = pktLine.decode(message);
        console.log(message);
      }
    };
    emit(null, pktLine.encode(["git-upload-pack", path], {host: host}, true));
    return function (err, item) {
      if (item === undefined) return emit(err);
      console.log(state, toString(item));
      states[state](item);
    };
  }

}

function toString(value) {
  if (value === null) return null;
  return bops.to(value);
}

lsRemote("github.com", "/creationix/conquest.git");
