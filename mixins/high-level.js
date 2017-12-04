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
  var fetchStream = fetchPackProtocol(transport);
  var pushStream = sendPackProtocol(transport);

  repo.clone = clone;
  repo.commit = commit;
  repo.push = push;
  repo.resolveRepo = resolveRepo;
  repo.getContentByHash = getContentByHash;

  function clone(callback) {
    fetchStream.take(function (err, refs) {
      fetchStream.put({
        want: refs['refs/heads/master']
      });

      fetchStream.put(null);
      fetchStream.put({
        done: true
      });

      fetchStream.take(function (err, channels) {
        repo.unpack(channels.pack, {}, function () {
          repo.updateRef('refs/heads/master', refs['refs/heads/master'], function () {
            return callback('Clonned !');
          });
        });
      });
    });
  }

  function commit(data, message, callback) {
    repo.readRef('refs/heads/master', function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, commit) {
        // Changes to files that already exists
        data['base'] = commit.tree;

        repo.createTree(data, function(err, treeHash) {
          var commitMessage = {
            author: {
                name: commit.author.name,
                email: commit.author.email
            },
            tree: treeHash,
            parent: refHash,
            message: message
          }

          repo.saveAs('commit', commitMessage, function(err, commitHash) {
            repo.updateRef('refs/heads/master', commitHash, function(err, res) {
              return callback('Commit done !');
            });
          });
        });
      });
    });
  }

  function push(callback) {
    repo.readRef('refs/heads/master', function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, commit) {
        pushStream.take(function() {
          pushStream.put({ oldhash: commit.parents[0], newhash: refHash, ref: 'refs/heads/master' });
          pushStream.put(null);

          var hashes = [refHash];
          repo.treeWalk(commit.tree, function(err, item) {
            function collectHashes(err, object) {
              if (object !== undefined) {
                hashes.push(object);
                item.read(collectHashes);
              } else {
                repo.pack(hashes, {}, function(err, stream) {
                  function putHashes(err, packObject) {
                    if (packObject !== undefined) {
                      pushStream.put(packObject);
                      stream.take(putHashes);
                    } else {
                      pushStream.put({flush: true});
                      return callback('pushStream done !');
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

  function resolveRepo(callback) {
    repo.readRef('refs/heads/master', function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, commit) {
        if (commit === undefined) { return callback(); }

        var repoStructure = {};
        repo.treeWalk(commit.tree, function(err, item) {
          
          function collectFiles(err, object) {
            if (object !== undefined) {
              repoStructure[object.path] = object;
              item.read(collectFiles);
            }
            else {
              return;
            }
          }

          item.read(collectFiles);
          callback(repoStructure);
        });
      });
    });
  }
}