"use strict";

var request = require('../net/request-xhr');
var fetchPackProtocol = require('../net/git-fetch-pack');
var sendPackProtocol = require('../net/git-send-pack');

module.exports = highLevel;

function highLevel(repo, uName, uPass, hostName) {

  require('./mem-db')(repo);
  require('./create-tree')(repo);
  require('./read-combiner')(repo);
  require('./pack-ops')(repo);
  require('./walkers')(repo);
  require('./formats')(repo);

  var httpTransport = require('../net/transport-http')(request);
  var transport = httpTransport(hostName, uName, uPass);
  var fetch = fetchPackProtocol(transport);
  var push = sendPackProtocol(transport);

  repo.clone = clone;
  repo.commit = commit;
  repo.push = push;

  function clone(callback) {
    fetch.take(function (err, refs) {
      fetch.put({
        want: refs['refs/heads/master']
      });

      fetch.put(null);
      fetch.put({
        done: true
      });

      fetch.take(function (err, channels) {
        repo.unpack(channels.pack, {}, function () {
          repo.updateRef('refs/heads/master', refs['refs/heads/master'], function () {
            callback('Clonned !');
          });
        });
      });
    });
  }

  function commit() {}

  function push() {}

}