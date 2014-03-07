var run = require('./run.js');
var bodec = require('bodec');
var sha1 = require('git-sha1');
var codec = require('../lib/object-codec.js');

var repo = {};
require('../mixins/mem-db.js')(repo);

var pack = require('./sample-pack.js');
var hashes;

run([
  function setup() {
    require('../mixins/pack-ops.js')(repo);
  },
  function testUnpack(end) {
    repo.unpack(singleStream(pack), {
      onProgress: onProgress
    }, function (err, result) {
      if (err) return end(err);
      hashes = result;
      end();
    });
    function onProgress(progress) {
      console.log(progress);
    }
  },
  function testPack(end) {
    var stream;
    repo.pack(hashes, {}, function (err, result) {
      if (err) return end(err);
      stream = result;
      stream.read(onRead);
    });
    function onRead(err, item) {
      if (err) return end(err);
      console.log(item);
      if (item) stream.read(onRead);
      else end();
    }

  }
]);

function singleStream(item) {
  var done = false;
  return { read: function (callback) {
    if (done) return callback();
    done = true;
    callback(null, item);
  }};

}