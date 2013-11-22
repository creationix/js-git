var jsGit = require('../.');
var net = require('net');
var inspect = require('util').inspect;

var db = memDb();
var repo = jsGit(db);
db.init(function (err) {
  if (err) throw err;
  require('./create.js')(repo, function (err) {
    if (err) throw err;
    console.log("Repo Initialized with sample data");
  });
});

var server = net.createServer(connectionHandler(function (req, callback) {
  if (req.path !== "/test.git") return callback(new Error("Unknown repo: " + req.path));
  callback(null, repo);
}));
server.listen(9418, "127.0.0.1", function () {
  console.log("GIT server listening at", server.address());
});

////////////////////// TCP transport for git:// uris ///////////////////////////

function connectionHandler(onReq, opts) {
  opts = opts || {};
  return function (socket) {
    var remote = wrap(socket), command;
    socket.on("error", onDone);
    remote.read(function (err, line) {
      if (err) return onDone(err);
      var match = line.match(/^(git-upload-pack|git-receive-pack) (.+?)\0(?:host=(.+?)\0)$/);
      if (!match) return onDone(new Error("Invalid connection message: " + line));
      command = match[1];
      onReq({
        path: match[2],
        host: match[3]
      }, onRepo);
    });

    function onRepo(err, repo) {
      if (err) return onDone(err);
      if (command === "git-upload-pack") {
        return repo.uploadPack(remote, opts, onDone);
      }
      if (command === "git-receive-pack") {
        return repo.receivePack(remote, opts, onDone);
      }
    }

    function onDone(err) {
      if (err) console.error(err.stack);
      socket.destroy();
    }
  };
}

var pktLine = require('./pkt-line.js');
function wrap(socket) {
  var queue = [];
  var rerr = null;
  var rcb = null, wcb = null;
  var onChunk = pktLine.deframer(onFrame);
  var writeFrame = pktLine.framer(writeChunk);
  socket.on("data", function (chunk) {
    try {
      onChunk(chunk);
    }
    catch (err) {
      rerr = err;
      check();
    }
  });
  socket.on("end", onChunk);
  socket.on("drain", onDrain);
  return { read: read, write: write };

  function onFrame(frame) {
    console.log("<-", inspect(frame, {colors:true}));
    queue.push(frame);
    check();
  }

  function read(callback) {
    if (!callback) return read;
    if (rcb) return callback(new Error("Only one read at a time"));
    rcb = callback;
    check();
  }

  function check() {
    if (rcb && (rerr || queue.length)) {
      var callback = rcb;
      rcb = null;
      if (rerr) {
        var err = rerr;
        rerr = null;
        callback(err);
      }
      else {
        callback(null, queue.shift());
      }
    }
    if (queue.length) socket.pause();
    else if (rcb) socket.resume();
  }

  function write(frame, callback) {
    if (callback === undefined) return write.bind(this, frame);
    if (callback) {
      if (wcb) return callback(new Error("Only one write at a time"));
      wcb = callback;
    }
    try {
      console.log("->", inspect(frame, {colors:true}));
      writeFrame(frame);
    }
    catch (err) {
      if (wcb) {
        wcb = null;
        callback(err);
      }
      else {
        throw err;
      }
    }
  }

  function writeChunk(chunk) {
    if (chunk === undefined) {
      socket.end();
      onDrain();
    }
    else if (socket.write(chunk)) {
      onDrain();
    }
  }

  function onDrain() {
    if (wcb) {
      var callback = wcb;
      wcb = null;
      callback();
    }
  }

}

/////////////////// inMemory database for easy testing /////////////////////////

function makeAsync(fn, callback) {
  if (!callback) return makeAsync.bind(this, fn);
  process.nextTick(function () {
    var result;
    try { result = fn(); }
    catch (err) { return callback(err); }
    if (result === undefined) return callback();
    return callback(null, result);
  });
}

function memDb() {

  // Store everything in ram!
  var objects;
  var others;
  var isHash = /^[a-z0-9]{40}$/;

  return {
    get: get,
    set: set,
    has: has,
    del: del,
    keys: keys,
    init: init,
    clear: init,
  };

  function get(key, callback) {
    return makeAsync(function () {
      if (isHash.test(key)) {
        return objects[key];
      }
      return others[key];
    }, callback);
  }

  function set(key, value, callback) {
    return makeAsync(function () {
      if (isHash.test(key)) {
        objects[key] = value;
      }
      else {
        others[key] = value.toString();
      }
    }, callback);
  }

  function has(key, callback) {
    return makeAsync(function () {
      if (isHash.test(key)) {
        return key in objects;
      }
      return key in others;
    }, callback);
  }

  function del(key, callback) {
    return makeAsync(function () {
      if (isHash.test(key)) {
        delete objects[key];
      }
      else {
        delete others[key];
      }
    }, callback);
  }

  function keys(prefix, callback) {
    return makeAsync(function () {
      var length = prefix.length;
      return Object.keys(others).filter(function (key) {
        return key.substr(0, length) === prefix;
      });
    }, callback);
  }

  function init(callback) {
    return makeAsync(function () {
      objects = {};
      others = {};
    }, callback);
  }

}
