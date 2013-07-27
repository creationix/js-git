var bops = require('bops');
var each = require('./each.js');
var parallel = require('./parallel.js');
var serial = require('./serial.js');

module.exports = function (interfaces) {
  var sha1 = extract(interfaces, "sha1");
  var inflate = extract(interfaces, "inflate");
  var deflate = extract(interfaces, "deflate");
  var root = extract(interfaces, "fs");

  return fsDb;
  function fsDb(path, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = null;
    }
    if (!callback) return fsDb.bind(this, fs, options);
    if (!options) options = {};
    var fs = root(path);
    if (!options.bare) fs = fs(".git");

    var db = {
      root: fs.root,
      write: write,
      read: read,
      save: save,
      load: load,
      remove: remove
    };

    if (options.init) {
      var config = { core: {
        repositoryformatversion: 0,
        filemode: true,
        bare: !!options.bare
      }};
      return init(config)(function (err) {
        if (err) return callback(err);
        callback(null, db);
      });
    }

    return callback(null, db);

    function hashToPath(hash) {
      return "objects/" + hash.substr(0, 2) + "/" + hash.substr(2);
    }

    function write(path, data, callback) {
      if (!callback) return write.bind(this, path, data);
      mkdirp(dirname(path), function (err) {
        if (err) return callback(err);
        fs.write(path, data)(callback);
      });
    }

    function read(path, callback) {
      if (!callback) return fs.read(path, "ascii");
      fs.read(path, "ascii")(callback);
    }

    function save(object, callback) {
      if (!callback) return save.bind(this, object);
      var buffer = encode(object);
      var hash = sha1(buffer);
      deflate(buffer, function (err, deflated) {
        if (err) return callback(err);
        write(hashToPath(hash), deflated, function (err) {
          if (err) return callback(err);
          callback(null, hash);
        });
      });
    }

    function load(hash, callback) {
      if (!callback) return load.bind(this, hash);
      fs.read(hashToPath(hash), function (err, deflated) {
        if (err) return callback(err);
        inflate(deflated, function (err, buffer) {
          if (err) return callback(err);
          var object;
          try { object = parse(buffer); }
          catch (err) { return callback(err); }
          callback(null, object);
        });
      });
    }

    function remove(hash, callback) {
      if (!callback) return remove.bind(this, hash);
      fs.unlink(hashToPath(hash), function (err) {
        if (err) return callback(err);
        fs.rmdir(dirname(path), function (err) {
          if (err && err.code !== "ENOTEMPTY") {
            return callback(err);
          }
          callback();
        });
      });
    }


    function init(config) {
      var conf = "";
      each(config, function (key, section) {
        conf += "[" + key + "]\n";
        each(section, function (key, value) {
          conf += "\t" + key + " = " + JSON.stringify(value) + "\n";
        });
      });
      var description = "Unnamed repository; edit this file 'description' to name the repository.\n";
      var exclude =
        "# Lines that start with '#' are comments.\n" +
        "# For a project mostly in C, the following would be a good set of\n" +
        "# exclude patterns (uncomment them if you want to use them):\n" +
        "# *.[oa]\n" +
        "# *~\n";
      return serial(
        fs.mkdir("."),
        parallel(
          fs.mkdir("branches"),
          write("config", conf),
          write("description", description),
          write("HEAD", "ref: refs/heads/master\n"),
          fs.mkdir("hooks"),
          serial(
            fs.mkdir("info"),
            write("info/exclude", exclude)
          ),
          serial(
            fs.mkdir("objects"),
            parallel(
              fs.mkdir("objects/info"),
              fs.mkdir("objects/pack")
            )
          ),
          serial(
            fs.mkdir("refs"),
            parallel(
              fs.mkdir("refs/heads"),
              fs.mkdir("refs/tags")
            )
          )
        )
      );
    }

    function mkdirp(path, callback) {
      if (!callback) return mkdirp.bind(this, path);
      fs.mkdir(path)(function (err) {
        if (!err || err.code === "EEXIST") return callback();
        if (err.code === "ENOENT") {
          return mkdirp(dirname(path), function (err) {
            if (err) return callback(err);
            mkdirp(path, callback);
          });
        }
        return callback(err);
      });
    }

  }
};

function extract(hash, name) {
  var implementation = hash[name];
  if (!implementation) throw new TypeError(name + " interface implementation instance required");
  return implementation;
}

function encode(object) {
  return bops.join([
    bops.from(object.type + " " + object.size + "\0"),
    object.body
  ]);
}

function indexOf(buffer, byte, i) {
  i = i || 0;
  var length = buffer.length;
  while (buffer[i] !== byte) {
    if (i === length) return -1;
    i += 1;
  }
  return i;
}

function parseAscii(buffer, start, end) {
  var val = "";
  while (start < end) {
    val += String.fromCharCode(buffer[start++]);
  }
  return val;
}

function parseDec(buffer, start, end) {
  var val = 0;
  while (start < end) {
    val = val * 10 + buffer[start++] - 0x30;
  }
  return val;
}

// Partially parse an object stream to extract out the type and size headers.
function decode(buffer) {
  var space = indexOf(buffer, 0x20);
  if (space < 0) throw new Error("Invalid git object buffer");
  var nil = indexOf(buffer, 0x00, space);
  if (nil < 0) throw new Error("Invalid git object buffer");
  return {
    type: parseAscii(buffer, 0, space),
    size: parseDec(buffer, space + 1, nil),
    body: bops.subarray(buffer, nil + 1)
  };
}

function dirname(path) {
  var index = path.lastIndexOf("/");
  if (index < 0) return "/";
  return path.substr(0, index);
}
