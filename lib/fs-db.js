var bops = require('bops');
var each = require('../helpers/each.js');
var parallel = require('../helpers/parallel.js');
var serial = require('../helpers/serial.js');
var platform = require('../lib/platform.js');
var sha1 = platform.require("sha1");
var inflate = platform.require("inflate");
var deflate = platform.require("deflate");
var root = platform.require("fs");

module.exports = function fsDb(path, bare) {
  var fs = root(path);
  var workingFs;

  if (!bare) {
    workingFs = fs;
    fs = fs(".git");
  }

  return {
    root: fs.root,
    fs: workingFs,
    write: write,
    read: read,
    save: save,
    load: load,
    remove: remove,
    init: init
  };

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
        if (sha1(buffer) !== hash) {
          return callback(new Error("SHA1 checksum failed for " + hash));
        }
        var object;
        try { object = decode(buffer); }
        catch (err) { return callback(err); }
        callback(null, object);
      });
    });
  }

  function remove(hash, callback) {
    if (!callback) return remove.bind(this, hash);
    var path = hashToPath(hash);
    fs.unlink(path, function (err) {
      if (err) return callback(err);
      fs.rmdir(dirname(path), function (err) {
        if (err && err.code !== "ENOTEMPTY" && err.code !== "ENOENT") {
          return callback(err);
        }
        callback();
      });
    });
  }


  function init(callback) {
    if (!callback) return init.bind(this);
    var config = { core: {
      repositoryformatversion: 0,
      filemode: true,
      bare: !!bare
    }};

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
    serial(
      function (callback) {
        if (bare) return callback();
        workingFs.mkdir(".", callback);
      },
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
    )(callback);
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
};

function encode(object) {
  return bops.join([
    bops.from(object.type + " " + object.body.length + "\0"),
    object.body
  ]);
}

function indexOf(buffer, byte, i) {
  i |= 0;
  var length = buffer.length;
  for (;;i++) {
    if (i >= length) return -1;
    if (buffer[i] === byte) return i;
  }
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
  var body = bops.subarray(buffer, nil + 1);
  var size = parseDec(buffer, space + 1, nil);
  if (size !== body.length) throw new Error("Invalid body length.");
  return {
    type: parseAscii(buffer, 0, space),
    body: body
  };
}

function dirname(path) {
  var index = path.lastIndexOf("/");
  if (index < 0) return ".";
  if (index === 0) return "/";
  return path.substr(0, index);
}
