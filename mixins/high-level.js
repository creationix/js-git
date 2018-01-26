// -*- mode: js; js-indent-level: 2; -*-

"use strict";

var request = require('../net/request-xhr');
var fetchPackProtocol = require('../net/git-fetch-pack');
var sendPackProtocol = require('../net/git-send-pack');

module.exports = highLevel;

function highLevel(repo, uName, uPass, hostName) {

  require('./mem-db')(repo);
  require('./create-tree')(repo);
  require('./pack-ops')(repo);
  require('./walkers')(repo);
  require('./formats')(repo);

  var httpTransport = require('../net/transport-http')(request);
  var transport = httpTransport(hostName, uName, uPass);

  repo.clone = clone;
  repo.commit = commit;
  repo.push = push;
  repo.resolveRepo = resolveRepo;
  repo.getContentByHash = getContentByHash;
  repo.transport = transport;

  function remoteRefs(callback) {
    var fetchStream = fetchPackProtocol(this.transport, callback);
    fetchStream.take(callback);
  }

  function clone(branch, depth, callback) {
    var fetchStream = fetchPackProtocol(this.transport, callback);
    fetchStream.take(function (err, refs) {
      if (!refs[branch]) {
	// create empty branch
        repo.updateRef(branch, "0000000000000000000000000000000000000000", function () {
          callback('create empty branch '+branch);
        });
	  return;
      }

      fetchStream.put({
        want: refs[branch]
      });
      if (depth) {
	fetchStream.put({
          deepen: depth
	});
      }
      fetchStream.put(null);

      repo.listRefs(false, function (err, haveRefs) {
	Object.values(haveRefs).forEach(function (refhash) {
	  fetchStream.put({
	    have: refhash
	  });
	});

	fetchStream.put({
          done: true
	});

	fetchStream.take(function (err, channels) {
          repo.unpack(channels.pack, {}, function () {
            repo.updateRef(branch, refs[branch], function () {
              return callback('Repo is cloned to '+refs[branch]);
            });
          });
	});
      });
    });
  }

  function commit(branch, changes, metadata, callback) {
    repo.readRef(branch, function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, parentcommit) {
        // Changes to files that already exists
        changes.base = parentcommit.tree;
        repo.createTree(changes, function(err, treeHash) {
          var commitObj = {
            tree: treeHash,
            author: metadata.author,
            message: metadata.message
          }

	  if (refHash != "0000000000000000000000000000000000000000") {
	    commitObj.parent = refHash;
	  }

          repo.saveAs('commit', commitObj, function(err, commitHash) {
            repo.updateRef(branch, commitHash, function(err, res) {
              return callback('Commit done.');
            });
          });
        });
      });
    });
  }

  function push(branch, callback) {
    var self = this;
    repo.readRef(branch, function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, commit) {
        var pushStream = sendPackProtocol(self.transport, callback);
        pushStream.take(function() {
	  if (commit.parents[0] === undefined) {
            pushStream.put({ oldhash: "0000000000000000000000000000000000000000", newhash: refHash, ref: branch });
	  } else {
	    pushStream.put({ oldhash: commit.parents[0], newhash: refHash, ref: branch });
	  }
          pushStream.put(null);

          var hashes = [refHash];
          repo.treeWalk(commit.tree, function(err, item) {
            function collectHashes(err, object) {
              if (object !== undefined) {
                hashes.push(object.hash);
                item.read(collectHashes);
              } else {
                repo.pack(hashes, {}, function(err, stream) {
                  function putHashes(err, packObject) {
                    if (packObject !== undefined) {
                      pushStream.put(packObject);
                      stream.take(putHashes);
                    } else {
                      pushStream.put({flush: true});
		      var takedone = function(_, response) {
			if (response && response.progress) {
			  callback(response.progress);
			}
			if (response === null) {
			  return callback(null);
			} else {
			  pushStream.take(takedone);
			}
		      }
		      pushStream.take(takedone);
                    }
                  }

                  stream.take(putHashes);
                });
              }
            }

            item.read(collectHashes);
          });
        });
      });
    });
  }

  function getContentByHash(hash, callback){
    repo.loadAs('text', hash, function(err, content){
      callback(content);
    })
  }

  function resolveRepo(branch, callback) {
    repo.readRef(branch, function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, commit) {
        var repoStructure = {};
        if (commit === undefined || commit.length === 0) {
	  repoStructure["/"] = {
	    body: {}
	  };
	  return callback(repoStructure);
	}

        repo.treeWalk(commit.tree, function(err, item) {
          function collectFiles(err, object) {
            if (object !== undefined && !err) {
              repoStructure[object.path] = object;
              item.read(collectFiles);
            } else {
	      if (err) {
		console.log(err);
	      }
              callback(repoStructure);
            }
          }

          item.read(collectFiles);
        });
      });
    });
  }
}
