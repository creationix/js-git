var extract = require('../helpers/extract.js');
var each = require('../helpers/each.js');
var parallel = require('../helpers/parallel.js');

module.exports = function (platform) {
  
  return {
    lsRemote: function (opts, callback) {
      return run(opts, lsMachine(opts), callback);
    },
    fetch: function (opts, callback) {
      opts.agent = opts.agent || extract(platform, "agent");
      return run(opts, fetch, callback);
    },
    push: function (opts, callback) {
      opts.agent = opts.agnet || extract(platform, "agent");
      return run(opts, push, callback);
    }
  };

  function run(opts, machine, callback) {
    if (opts.protocol === "git:") {
      opts.port = opts.port ? parseInt(opts.port, 10) : 9418;
      var tcp = extract(platform, "tcp");
      return tcp.connect(opts.port, opts.hostname, function (err, socket) {
        if (err) return callback(err);
        require('../transports/tcp.js')(socket, machine, callback);
      });
    }
    throw new TypeError(opts.protocol + " protocol not supported");
  }

};

function lsMachine(opts) { return function (write, emit) {
  write("git-upload-pack " + opts.pathname + "\0host=" + opts.hostname + "\0");
  return refsMachine(write, function (refs) {
    write(null);
    emit(refs);
  });
}}

function refsMachine(write, emit) {
  var refs = {};
  var caps = null;
  return onLine;

  function onLine(line) {
    if (line === null) {
      return emit(refs, caps);
    }
    line = line.trim();
    if (!caps) line = pullCaps(line);
    var index = line.indexOf(" ");
    refs[line.substr(index + 1)] = line.substr(0, index);
    return onLine;
  }

  function pullCaps(line) {
    var index = line.indexOf("\0");
    caps = {};
    line.substr(index + 1).split(" ").map(function (cap) {
      var pair = cap.split("=");
      caps[pair[0]] = pair[1] || true;
    });
    return line.substr(0, index);
  }
}

function fetchMachine(opts, repo, write, emit) {
  var refs;
  var tasks;
  var state;
  write("git-upload-pack " + opts.pathname + "\0host=" + opts.hostname + "\0");
  return refsMachine(write, function (result, serverCaps) {
    refs = result;
    tasks = [];
    var wants = [];
    each(refs, function (name, hash) {
      if (name === "HEAD" || name.indexOf('^') > 0) return;
      tasks.push(repo.writeRaw(name, hash));
      wants.push("want " + hash);
    });
    var caps = [];
    if (serverCaps["ofs-delta"]) caps.push("ofs-delta");
    if (opts.includeTag && serverCaps["include-tag"]) caps.push("include-tag");
    if ((opts.onProgress || opts.onError) &&
        (serverCaps["side-band-64k"] || serverCaps["side-band"])) {
      caps.push(serverCaps["side-band-64k"] ? "side-band-64k" : "side-band");
      if (!opts.onProgress && serverCaps["no-progress"]) {
        caps.push("no-progress");
      }
    }
    if (serverCaps["agent"]) caps.push("agent=" + opts.agent);
    wants[0] += " " + caps.join(" ");
    wants.forEach(function (want) {
      write(want + "\n");
    });
    write(null);
    write("done\n");
    return done;

  });

  function done(line) {
    if (line.trim() !== "NAK") throw new Error("Expected NAK");
    parse = unpacker(opts, repo);
    return pack;
  }

  function pack(item) {
    if (!item) {
      // throw new Error("TODO: Implement me");
    }
    else if (item.progress) {
      if (opts.onProgress) opts.onProgress(item.progress);
    }
    else if (item.error) {
      if (opts.onError) opts.onError(item.error);
    }
    else {
      parse(item);
    }
    return pack;
  }

  // TODO: put this code where it belongs
  // parallel(tasks)(function (err) {
  //   if (err) return callback(err);
  // });
}

function pushMachine(opts, repo, write, emit) {
  throw new Error("TODO: Implement pushMachine");
}

function unpacker(opts, repo) {
  return parse;
  function parse(chunk) {
    console.log(chunk);
  }
}
