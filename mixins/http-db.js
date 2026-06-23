// -*- mode: js; js-indent-level: 2; -*-

// Get refs:
// $ curl -H "Authorization: Basic bm9uZToxajM4OGRtZDhsZnRvamJuazI3enN0b3BrYXQ2bHZtcXU3dDYwOWh3cmdhdmt4N3Zkbw==" http://172.17.0.2:9001/2tlax-s0uqq-u6kz3a8x06tczjb.git/info/refs
// 51779a651e7125f07b537cd1785bae642996f1f9	refs/heads/master
//
// Get object:
// $ curl -O -H "Authorization: Basic bm9uZToxajM4OGRtZDhsZnRvamJuazI3enN0b3BrYXQ2bHZtcXU3dDYwOWh3cmdhdmt4N3Zkbw==" http://172.17.0.2:9001/a/a.git/objects/51/779a651e7125f07b537cd1785bae642996f1f9
//
// Get packs:
// curl -H "Authorization: Basic bm9uZToxajM4OGRtZDhsZnRvamJuazI3enN0b3BrYXQ2bHZtcXU3dDYwOWh3cmdhdmt4N3Zkbw==" http://172.17.0.2:9001/2tlax-s0uqq-a997dxaw11u0lyr.git/objects/info/packs
//
// P pack-4cb362a32ab3424490c7c3dfe28dc69e4016459c.pack

var request = require('../net/request-xhr');
var inflate = require('../lib/inflate');
var codec = require('../lib/object-codec.js');
var sha1 = require('git-sha1');
var parseIndex = require('../lib/pack-index').parseIndex;
var parsePackEntry = require('../lib/pack-codec').parseEntry;
var applyDelta = require('../lib/apply-delta');

module.exports = mixin;
var isHash = /^[0-9a-f]{40}$/;

function mixin(repo, username, password, hostName) {
  var cachedIndexes = {};
  var headers = {};
  if (username) {
    headers.Authorization = "Basic " + btoa(username + ":" + (password || ""));
  }

  repo.readRef = readRef;
  repo.listRefs = listRefs;

  repo.loadAs = loadAs;
  repo.loadRaw = loadRaw;

  repo.hasHash = hasHash;

  function readRef(ref, callback) {
    return listRefs(null, function(err, out) {
      console.log("out "+ref);
      console.log(out);
      callback(err, out[ref]);
    });
  }

  function listRefs(prefix, callback) {
    return request("GET", hostName+"/info/refs", headers, null, function (err, response) {
      if (response.statusCode != 200) {
	return callback("Error code " + response.statusCode, null);
      }
      var refs = {};
      if (response.body) {
	var regex = prefix && new RegExp("^" + prefix + "[/$]");
	var sp = response.body.split("\n");
	for (var i in sp) {
	  var m = sp[i].match(/^([0-9a-f]{40})\t(.*)$/);
	  if (m) {
            if (regex && !regex.test(m[2])) continue;
	    refs[m[2]] = m[1];
	  }
	}
      }
      console.log(refs);
      callback(err, refs);
    }, "text");
  }

  function hasHash(hash, callback) {
    return loadRaw(hash, function (err, body) {
      if (err) return callback(err);
      return callback(null, !!body);
    });
  }

  function loadAs(type, hash, callback) {
    return loadRaw(hash, function(err, buffer) {
      if (!buffer) return [];
      var obj = codec.deframe(buffer, true);
      if (obj.type !== type) throw new TypeError("Type mismatch " + obj.type + "!==" + type);
      callback(err, obj.body);
    });
  }

  function loadRaw(hash, callback) {
    return request("GET", hostName+"/objects/"+hash.substr(0, 2)+"/"+hash.substr(2), headers, null, function(err, response) {
      if (response.statusCode == 200) {
	var raw;
	try { raw = inflate(response.body); }
	catch (err) { return callback(err); }
	return callback(err, raw);
      }
      return loadRawPacked(hash, callback);
    }, "arraybuffer");
  }

  function loadRawPacked(hash, callback) {
    var packHashes = [];
    return request("GET", hostName+"/objects/info/packs", headers, null, function(err, response) {
      if (!response.body) return callback(err);
      response.body.split("\n").forEach(function (line) {
        var match = line.match(/P pack-([0-9a-f]{40}).pack/);
        if (match) packHashes.push(match[1]);
      });
      start();
    }, "text");

    function start() {
      var packHash = packHashes.pop();
      var offsets;
      if (!packHash) return callback();
      if (!cachedIndexes[packHash]) loadIndex(packHash);
      else onIndex();

      function loadIndex() {
	return request("GET", hostName+"/objects/pack/pack-" + packHash + ".idx", headers, null, function(err, response) {
	  var buffer = response.body;
          if (!buffer) return callback(err);
	  console.log("Looking at index");
          try {
            cachedIndexes[packHash] = parseIndex(buffer);
          }
          catch (err) {
	    console.log("failure " +err);
	    return callback(err); }
	  console.log("cachedIndexes");
	  console.log(cachedIndexes);
          onIndex();
        });
      }

      function onIndex() {
        var cached = cachedIndexes[packHash];
        var packFile = hostName+"/objects/pack/pack-" + packHash + ".pack";
        var index = cached.byHash[hash];
	console.log("looking for "+hash+" in "+packHash+" index");
	console.log(index);
        if (!index) return start();
        offsets = cached.offsets;
        loadChunk(packFile, index.offset, callback);
      }

      function loadChunk(packFile, start, callback) {
        var index = offsets.indexOf(start);
        if (index < 0) {
          var error = new Error("Can't find chunk starting at " + start);
          return callback(error);
        }
        var end = index + 1 < offsets.length ? offsets[index + 1] : -20;
	// FIXME git http-backend doesn't actually support Range requests,
	// so this doesn't work.  Will need to download the whole packfile.
	var headerWithRange = {Authorization: headers.Authorization, Range: "bytes="+start+"-"+end};
	console.log("loading chunk "+packFile);
	console.log(headerWithRange);
	return request("GET", packFile, headerWithRange, null, function(err, response) {
	  var chunk = response.body;
          if (!chunk) return callback(err);
          var raw;
          try {
            var entry = parsePackEntry(chunk);
            if (entry.type === "ref-delta") {
              return loadRaw.call(repo, entry.ref, onBase);
            }
            else if (entry.type === "ofs-delta") {
              return loadChunk(packFile, start - entry.ref, onBase);
            }
            raw = codec.frame(entry);
          }
          catch (err) { return callback(err); }
          callback(null, raw);

          function onBase(err, base) {
            if (!base) return callback(err);
            var object = codec.deframe(base);
            var buffer;
            try {
              object.body = applyDelta(entry.body, object.body);
              buffer = codec.frame(object);
            }
            catch (err) { return callback(err); }
            callback(null, buffer);
          }
        });
      }

    }
  }

}
