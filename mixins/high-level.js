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
  repo.resolveRepo = resolveRepo;

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
            return callback('Clonned !');
          });
        });
      });
    });
  }

  function commit(callback) {
    repo.readRef('refs/heads/master', function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, commit) {
        // Changes to files that already exists
        var changes = [
          {
              path: "/test/justAdded22.txt",
              mode: modes.file,
              content: ""
          },
          {
              path: "/test/second.txt",
              mode: modes.file,
              content: "This is the updated content 111safa."
          }
        ];
        changes['base'] = commit.tree;

        repo.createTree(changes, function(err, treeHash) {
          var commitMessage = {
            author: {
                name: commit.author.name,
                email: commit.author.email
            },
            tree: treeHash,
            parent: refHash,
            message: "This is the commit message.\n"
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
        push.take(function() {
          push.put({ oldhash: commit.parents[0], newhash: refHash, ref: 'refs/heads/master' });
          push.put(null);

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
                      push.put(packObject);
                      stream.take(putHashes);
                    } else {
                      push.put({flush: true});
                      return callback('Push done !');
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

  function resolveRepo(callback) {
    repo.readRef('refs/heads/master', function(err, refHash) {
      repo.loadAs('commit', refHash, function(err, commit) {
        if (commit === undefined) { return callback(); }

        var files = [];
        repo.treeWalk(commit.tree, function(err, item) {
          /*
            {
              '/': {
                mode: xxx,
                hash: xzz,
                'folder 1': {
                  mode: xxx,
                  hash: xzz,
                  text.txt: {
                    mode: xxx,
                    hash: xzz,
                    content: 'asasgfasgagga'
                  }
                }
              }
            }
          */
          function collectFiles(err, object) {
            if (object !== undefined) {
              var loadType = object.mode === 16384 ? 'tree' : 'text';
              console.log(object);
              var pathArray = object.path.split('/').filter(function(element) {
                return element.length !== 0;
              });

              console.log(pathArray);
              repo.loadAs(loadType, object.hash, function(err, content) {
                //console.log(content);
                //files.push(content);
                item.read(collectFiles);
              });
            } else {
              return callback(files);
            }
          }

          item.read(collectFiles);
        });
      });
    });
  }

}