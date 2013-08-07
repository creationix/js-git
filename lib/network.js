var extract = require('../helpers/extract.js');
var each = require('../helpers/each.js');
var parallel = require('../helpers/parallel.js');

module.exports = function (platform) {
  var urlParse = extract(platform, "urlParse");
  
  return {
    lsRemote: function (url, callback) {
      var url = urlParse(url);
      return runMachine(url, function (write, emit) {
        return lsRemoteMachine(url.pathname, url.hostname, write, emit);
      }, callback);
    },
    fetch: function (url, repo, callback) {
      var url = urlParse(url);
      url.version = extract(platform, "version");
      return runMachine(url, function (write, emit) {
        return fetchMachine(url, repo, write, emit);
      }, callback);
    },
    push: function (url, repo, callback) {
      var url = urlParse(url);
      return runMachine(url, function (write, emit) {
        return pushMachine(url.pathname, url.hostname, repo, write, emit);
      }, callback);
    }
  };

  function runMachine(url, machine, callback) {
    if (!callback) return runMachine.bind(this, url, machine);
    url.port = url.port ? parseInt(url.port, 10) : 9418;
    if (url.protocol === "git:") {
      var tcp = extract(platform, "tcp");
      return tcp.connect(url.port, url.hostname, function (err, socket) {
        if (err) return callback(err);
        require('../transports/tcp.js')(socket, machine, callback);
      });
    }
    throw new TypeError(url.protocol + " urls not supported");
  }
};

function lsRemoteMachine(path, host, write, emit) {
  write("git-upload-pack " + path + "\0host=" + host + "\0");
  return refsMachine(write, function (refs) {
    write(null);
    emit(refs);
  });
}

function refsMachine(write, emit) {
  var refs = {};
  var caps = null;
  return onLine;

  function onLine(line) {
    line = line[1];
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
  write("git-upload-pack " + opts.pathname + "\0host=" + opts.hostname + "\0");
  return refsMachine(write, function (result) {
    console.log(refs)
    refs = result;
    tasks = [];
    var wants = [];
    each(refs, function (name, hash) {
      if (name === "HEAD" || name.indexOf('^') > 0) return;
      tasks.push(repo.writeRaw(name, hash));
      wants.push("want " + hash);
    });
    wants[0] += "multi_ack_detailed side-band-64k thin-pack ofs-delta agent=js-git/" + opts.version;
    wants.forEach(function (want) {
      write(want + "\n");
    });
    // write(null);
    // write("done\n");
    return pack;

  });

  function pack(line) {
    console.log("line", line);
    return pack;
  }

    // parallel(tasks)(function (err) {
    //   if (err) return callback(err);
    // });
}

function pushMachine(path, host, repo, write, emit) {
  throw new Error("TODO: Implement pushMachine");
}

