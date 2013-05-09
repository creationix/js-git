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
      .pushWrap(pktLine.decoder, pktLine.encoder)
      .run(client.source, client.sink);

  });

  function app(emit) {
    emit(null, bops.from("git-upload-pack " + path + "\0host=" + host + "\0"));
    return function (err, item) {
      console.log(item);
      if (item === undefined) return emit(err);
      console.log("RESPONSE", toString(item));
    };
  }

}

function toString(value) {
  if (value === null) return null;
  return bops.to(value);
}

lsRemote("github.com", "/creationix/conquest.git");
