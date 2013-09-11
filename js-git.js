module.exports = function (platform) {

  return newRepo;

  // platform options are: db, proto, and trace
  function newRepo(db, workDir) {
    var trace = platform.trace;
    var sha1 = platform.sha1;
    var bops = platform.bops;
    var urlParse = require('./lib/url-parse.js');

    var encoders = {
      commit: encodeCommit,
      tag: encodeTag,
      tree: encodeTree,
      blob: encodeBlob
    };

    var decoders = {
      commit: decodeCommit,
      tag: decodeTag,
      tree: decodeTree,
      blob: decodeBlob
    };

    var repo = {};

    if (db) {
      // Git Objects
      repo.load = load;       // (hashish) -> object
      repo.save = save;       // (object) -> hash
      repo.loadAs = loadAs;   // (type, hashish) -> value
      repo.saveAs = saveAs;   // (type, value) -> hash
      repo.remove = remove;   // (hashish)

      // Refs
      repo.resolveHashish = resolveHashish; // (hashish) -> hash
      repo.updateHead = updateHead;         // (hash)
      repo.getBranch = getBranch;           // () -> branchName
      repo.setBranch = setBranch;           // (branchName)
      repo.createBranch = createBranch;     // (branchName, hash)
      repo.deleteBranch = deleteBranch;     // (branchName)
      repo.listBranches = listBranches;     // () -> branchNames
      repo.createTag = createTag;           // (tagName, hash)
      repo.deleteTag = deleteTag;           // (tagName)
      repo.listTags = listTags;             // () -> tagNames

      if (workDir) {
        // TODO: figure out API for working repos
      }
    }

    // Network Protocols

    repo.lsRemote = lsRemote;
    if (db) {
      repo.fetch = fetch;
      repo.push = push;
    }

    return repo;

    function load(hashish, callback) {
      if (!callback) return load.bind(this, hashish);
      return resolveHashish(hashish, function (err, hash) {
        if (err) return callback(err);
        return db.load(hash, function (err, buffer) {
          if (err) return callback(err);
          var type, object;
          try {
            if (sha1(buffer) !== hash) {
              throw new Error("Hash checksum failed for " + hash);
            }
            var pair = deframe(buffer);
            type = pair[0];
            buffer = pair[1];
            object = {
              type: type,
              body: decoders[type](buffer)
            };
          } catch (err) {
            if (err) return callback(err);
          }
          if (trace) trace("load", hash);
          return callback(null, object, hash);
        });
      });
    }

    function save(object, callback) {
      if (!callback) return save.bind(this, object);
      var buffer, hash;
      try {
        buffer = encoders[object.type](object.body);
        buffer = frame(object.type, buffer);
        hash = sha1(buffer);
      }
      catch (err) {
        return callback(err);
      }
      return db.save(hash, buffer, function (err) {
        if (err) return callback(err);
        if (trace) trace("save", hash);
        return callback(null, hash);
      });
    }

    function loadAs(type, hashish, callback) {
      if (!callback) return loadAs.bind(this, type, hashish);
      return load(hashish, function (err, object, hash) {
        if (err) return callback(err);
        if (object.type !== type) {
          return new Error("Expected " + type + ", but found " + object.type);
        }
        return callback(null, object.body, hash);
      });
    }

    function saveAs(type, body, callback) {
      if (!callback) return saveAs.bind(this, type, body);
      return save({ type: type, body: body }, callback);
    }

    function remove(hashish, callback) {
      if (!callback) return remove.bind(this, hashish);
      return resolveHashish(hashish, function (err, hash) {
        if (err) return callback(err);
        return db.remove(hash, function (err) {
          if (err) return callback(err);
          if (trace) trace("remove", hash);
          return callback(null, hash);
        });
      });
    }

    function resolveHashish(hashish, callback) {
      if (!callback) return resolveHashish.bind(this, hashish);
      hashish = hashish.trim();
      if ((/^[0-9a-f]{40}$/i).test(hashish)) {
        return callback(null, hashish.toLowerCase());
      }
      if (hashish === "HEAD") {
        return getBranch(function (err, ref) {
          if (err) return callback(err);
          return resolveHashish(ref, callback);
        });
      }
      if ((/^refs\//).test(hashish)) {
        return db.read(hashish, checkBranch);
      }
      return checkBranch();
      function checkBranch(err, hash) {
        if (err) return callback(err);
        if (hash) return resolveHashish(hash, callback);
        return db.read("refs/heads/" + hashish, checkTag);
      }
      function checkTag(err, hash) {
        if (err) return callback(err);
        if (hash) return resolveHashish(hash, callback);
        return db.read("refs/tags/" + hashish, final);
      }
      function final(err, hash) {
        if (err) return callback(err);
        if (hash) return resolveHashish(hash, callback);
        return callback(new Error("Cannot find hashish: " + hashish));
      }
    }

    function updateHead(hash, callback) {
      if (!callback) return updateHead.bind(this, hash);
      return getBranch(function (err, ref) {
        if (err) return callback(err);
        return db.write(ref, hash + "\n", callback);
      });
    }

    function getBranch(callback) {
      if (!callback) return getBranch.bind(this);
      return db.read("HEAD", function (err, ref) {
        if (err) return callback(err);
        if (!ref) return callback(new Error("Missing HEAD"));
        var match = ref.match(/^ref: *(.*)/);
        if (!match) return callback(new Error("Invalid HEAD"));
        return callback(null, match[1]);
      });
    }

    function setBranch(branchName, callback) {
      if (!callback) return setBranch.bind(this, branchName);
      return db.write("HEAD", "ref: refs/heads/" + branchName + "\n", callback);
    }

    function createBranch(branchName, hash, callback) {
      if (!callback) return createBranch.bind(this, branchName, hash);
      return createThing("refs/heads/", branchName, hash, callback);
    }

    function createTag(tagName, hash, callback) {
      if (!callback) return createTag.bind(this, tagName, hash);
      return createThing("refs/tags/", tagName, hash, callback);
    }

    function createThing(prefix, name, hash, callback) {
      return db.write(prefix + name, hash + "\n", callback);
    }

    function deleteBranch(branchName, callback) {
      if (!callback) return deleteBranch.bind(this, branchName);
      return deleteThing("refs/heads/", branchName, callback);
    }

    function deleteTag(tagName, callback) {
      if (!callback) return deleteTag.bind(this, tagName);
      return deleteThing("refs/tags/", tagName, callback);
    }

    function deleteThing(prefix, name, callback) {
      return db.unlink(prefix + name, callback);
    }

    function listBranches(callback) {
      if (!callback) return listBranches.bind(this);
      return listThings("refs/heads/", callback);
    }

    function listTags(callback) {
      if (!callback) return listTags.bind(this);
      return listThings("refs/tags/", callback);
    }

    function listThings(prefix, callback) {
      var branches = {};
      return loadDir(prefix, function (err) {
        if (err) return callback(err);
        callback(null, branches);
      });

      function loadDir(dir, callback) {
        var list;
        return db.readdir(dir, function (err, names) {
          if (err) return callback(err);
          list = new Array(names.length);
          for (var i = 0, l = names.length; i < l; ++i) {
            list[i] = dir + "/" + names[i];
          }
          return shift();
        });
        function shift(err) {
          if (err) return callback(err);
          var target = list.shift();
          if (!target) return callback();
          return db.read(target, function (err, hash) {
            if (err) return callback(err);
            if (hash) {
              branches[target.substr(11)] = hash.trim();
              return shift();
            }
            return loadDir(target, shift);
          });
        }
      }
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

    function parseOct(buffer, start, end) {
      var val = 0;
      while (start < end) {
        val = (val << 3) + buffer[start++] - 0x30;
      }
      return val;
    }

    function deframe(buffer) {
      var space = indexOf(buffer, 0x20);
      if (space < 0) throw new Error("Invalid git object buffer");
      var nil = indexOf(buffer, 0x00, space);
      if (nil < 0) throw new Error("Invalid git object buffer");
      var body = bops.subarray(buffer, nil + 1);
      var size = parseDec(buffer, space + 1, nil);
      if (size !== body.length) throw new Error("Invalid body length.");
      return [
        parseAscii(buffer, 0, space),
        body
      ];
    }

    function frame(type, body) {
      return bops.join([
        bops.from(type + " " + body.length + "\0"),
        body
      ]);
    }

    // A sequence of bytes not containing the ASCII character byte
    // values NUL (0x00), LF (0x0a), '<' (0c3c), or '>' (0x3e).
    // The sequence may not begin or end with any bytes with the
    // following ASCII character byte values: SPACE (0x20),
    // '.' (0x2e), ',' (0x2c), ':' (0x3a), ';' (0x3b), '<' (0x3c),
    // '>' (0x3e), '"' (0x22), "'" (0x27).
    function safe(string) {
      return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, "");
    }

    function formatDate(date) {
      var timezone = (date.timeZoneoffset || date.getTimezoneOffset()) / 60;
      var seconds = Math.floor(date.getTime() / 1000);
      return seconds + " " + (timezone > 0 ? "-0" : "0") + timezone + "00";
    }

    function encodePerson(person) {
      if (!person.name || !person.email) {
        throw new TypeError("Name and email are required for person fields");
      }
      return safe(person.name) +
        " <" + safe(person.email) + "> " +
        formatDate(person.date || new Date());
    }

    function encodeCommit(commit) {
      if (!commit.tree || !commit.author || !commit.message) {
        throw new TypeError("Tree, author, and message are require for commits");
      }
      var parents = commit.parents || (commit.parent ? [ commit.parent ] : []);
      if (!Array.isArray(parents)) {
        throw new TypeError("Parents must be an array");
      }
      var str = "tree " + commit.tree;
      for (var i = 0, l = parents.length; i < l; ++i) {
        str += "\nparent " + parents[i];
      }
      str += "\nauthor " + encodePerson(commit.author) +
             "\ncommitter " + encodePerson(commit.committer || commit.author) +
             "\n\n" + commit.message;
      return bops.from(str);
    }

    function encodeTag(tag) {
      if (!tag.object || !tag.type || !tag.tag || !tag.tagger || !tag.message) {
        throw new TypeError("Object, type, tag, tagger, and message required");
      }
      var str = "object " + tag.object +
        "\ntype " + tag.type +
        "\ntag " + tag.tag +
        "\ntagger " + encodePerson(tag.tagger) +
        "\n\n" + tag.message;
      return bops.from(str + "\n" + tag.message);
    }

    function pathCmp(a, b) {
      a += "/"; b += "/";
      return a < b ? -1 : a > b ? 1 : 0;
    }

    function encodeTree(tree) {
      var chunks = [];
      Object.keys(tree).sort(pathCmp).forEach(function (name) {
        var entry = tree[name];
        chunks.push(
          bops.from(entry.mode.toString(8) + " " + name + "\0"),
          bops.from(entry.hash, "hex")
        );
      });
      return bops.join(chunks);
    }

    function encodeBlob(blob) {
      if (bops.is(blob)) return blob;
      return bops.from(blob);
    }

    function decodePerson(string) {
      var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
      if (!match) throw new Error("Improperly formatted person string");
      var sec = parseInt(match[3], 10);
      var date = new Date(sec * 1000);
      date.timeZoneoffset = parseInt(match[4], 10) / 100 * -60;
      return {
        name: match[1],
        email: match[2],
        date: date
      };
    }


    function decodeCommit(body) {
      var i = 0;
      var start;
      var key;
      var parents = [];
      var commit = {
        tree: "",
        parents: parents,
        author: "",
        committer: "",
        message: ""
      };
      while (body[i] !== 0x0a) {
        start = i;
        i = indexOf(body, 0x20, start);
        if (i < 0) throw new SyntaxError("Missing space");
        key = parseAscii(body, start, i++);
        start = i;
        i = indexOf(body, 0x0a, start);
        if (i < 0) throw new SyntaxError("Missing linefeed");
        var value = bops.to(bops.subarray(body, start, i++));
        if (key === "parent") {
          parents.push(value);
        }
        else {
          if (key === "author" || key === "committer") {
            value = decodePerson(value);
          }
          commit[key] = value;
        }
      }
      i++;
      commit.message = bops.to(bops.subarray(body, i));
      return commit;
    }

    function decodeTag(body) {
      var i = 0;
      var start;
      var key;
      var tag = {};
      while (body[i] !== 0x0a) {
        start = i;
        i = indexOf(body, 0x20, start);
        if (i < 0) throw new SyntaxError("Missing space");
        key = parseAscii(body, start, i++);
        start = i;
        i = indexOf(body, 0x0a, start);
        if (i < 0) throw new SyntaxError("Missing linefeed");
        var value = bops.to(bops.subarray(body, start, i++));
        if (key === "tagger") value = decodePerson(value);
        tag[key] = value;
      }
      i++;
      tag.message = bops.to(bops.subarray(body, i));
      return tag;
    }

    function decodeTree(body) {
      var i = 0;
      var length = body.length;
      var start;
      var mode;
      var name;
      var hash;
      var tree = [];
      while (i < length) {
        start = i;
        i = indexOf(body, 0x20, start);
        if (i < 0) throw new SyntaxError("Missing space");
        mode = parseOct(body, start, i++);
        start = i;
        i = indexOf(body, 0x00, start);
        name = bops.to(bops.subarray(body, start, i++));
        hash = bops.to(bops.subarray(body, i, i += 20), "hex");
        tree.push({
          mode: mode,
          name: name,
          hash: hash
        });
      }
      return tree;
    }

    function decodeBlob(body) {
      return body;
    }


    function processUrl(url) {
      var opts = urlParse(url);
      if (opts.protocol === "git:") {
        if (!platform.tcp) throw new Error("Platform does not support git: urls");
        return require('./lib/tcp.js')(opts, platform.tcp);
      }
      if (opts.protocol === "http:" || opts.protocol === "https:") {
        if (!platform.http) throw new Error("Platform does not support http(s): urls");
        return require('./lib/smart-http.js')(opts, platform.http);
      }
      if (opts.protocol === "ws:" || opts.protocol === "wss:") {
        if (!platform.ws) throw new Error("Platform does not support ws(s): urls");
        return require('./lib/ws.js')(opts, platform.ws);
      }
      if (opts.protocol === "ssh:") {
        if (!platform.ssh) throw new Error("Platform does not support ssh: urls");
        return require('./lib/ssh.js')(opts, platform.ssh);
      }
      throw new Error("Unknown protocol " + opts.protocol);
    }

    function lsRemote(url, callback) {
      if (!callback) return lsRemote.bind(this);
      var proto;
      try {
        proto = processUrl(url);
      }
      catch (err) {
        return callback(err);
      }
      proto.discover(function (err, refs) {
        if (err) return callback(err);
        proto.close(function (err) {
          if (err) return callback(err);
          callback(null, refs);
        });
      });
    }

    function fetch() {
      throw new Error("TODO: Implement repo.fetch");
    }

    function push() {
      throw new Error("TODO: Implement repo.fetch");
    }



  }

};