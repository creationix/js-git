(function () {
"use strict";

var require = window.require = makeRequire("/");
require.resolve = resolve;
function makeRequire(root) {
function require(path) {
  return realRequire(root, path);
}
function requireAsync(path, callback) {
  realRequireAsync(root, path, function (module) {
    callback(null, module);
  }, callback);
}
require.async = requireAsync;
return require;
}


////////////////////////////////////////////////////////////////////////////////
// Get source files via XHR.
// Protect calls to get to cache and not allow concurrent requests.
// This I/O can be very expensive.
var files = {};
var missing = {};
var pendingGet = {};
function get(path, callback, errback) {
  if (path in files) return callback(path, files[path]);
  if (path in missing) return errback(missing[path]);
  if (path in pendingGet) return pendingGet[path].push([callback, errback]);
  pendingGet[path] = [[callback, errback]];
  realGet(path, function (contents) {
    files[path] = contents;
    flush();
  }, function (err) {
    missing[path] = err;
    flush();
  });
  function flush() {
    var pending = pendingGet[path];
    delete pendingGet[path];
    pending.forEach(function (pair) {
      get(path, pair[0], pair[1]);
    });
  }
}
function realGet(path, callback, errback) {
  var request = new XMLHttpRequest();
  request.onload = function () {
    callback(this.responseText);
  };
  request.onerror = function () {
    errback(this);
  };
  request.open("GET", path + "?" + (Math.random() * 0x100000000).toString(36), true);
  request.send();
}
////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////
// Use a temporary filesystem to write the wrapped js files.
// The writeFile function outputs the url the file that a script tag can use.
var fs;
var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
requestFileSystem(window.TEMPORARY, null, function (fileSystem) {
  fs = fileSystem;
  window.modulesReady();
}, function (fileError) {
  throw new Error("Unable to create temporary fs for module loader: " + fileError);
});
function writeFile(path, contents, callback, errback) {
  fs.root.getFile(path, {create: true}, function (fileEntry) {
    fileEntry.createWriter(function (fileWriter) {
      var truncated = false;
      fileWriter.onwriteend = function () {
        if (!truncated) {
          truncated = true;
          this.truncate(this.position);
          return;
        }
        callback(fileEntry.toURL());
      };
      fileWriter.onerror = errback;
      fileWriter.write(new Blob([contents], {type: 'text/plain'}));
    }, errback);
  }, errback);
}
////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////
// Resolve relative paths to absolute paths.
// Also implements module lookup logic and automatic file extensions.
// Root is always an absolute path starting and ending with a `/`
// path is the actual string used in require.
// If path starts with a `/`, then it's an absolute require.
// If paths starts with a `.`, then it's a relative require.
// Otherwise it's a module path and we must search for it.
// We also want to support optional extensions, loading json files, and
// parsing package.json looking for main.
// callback(realPath, contents) or errback(err) are the output.
var mappings = {};
require.mappings = mappings;
require.resolve = resolve;
function resolve(root, path, callback, errback) {
  function success(fullPath, contents) {
    mappings[root + ":" + path] = fullPath;
    callback(fullPath, contents);
  }
  if (path[0] === "/") return find(path, success, errback);
  if (path[0] === ".") return find(realPath(root + path), success, errback);
  var base = root;
  cycle();
  function cycle() {
    base = base.match(/^(.*\/)[^\/]*$/)[1];
    find(base + "modules/" + path, success, function () {
      if (base.length > 1) {
        base = base.substr(0, base.length - 1);
        cycle();
      }
      else {
        errback(new Error("Can't find module: " + path + " in " + root));
      }
    });
  }
}
function realPath(path) {
  var match;
  // Remove /./ entries from path
  while (match = path.match(/(\/)\.\//)) {
    path = path.replace(match[0], match[1]);
  }
  // Convert /foo/../ entries from path
  while (match = path.match(/(\/[^\/]*\/)\.\.\//)) {
    path = path.replace(match[0], match[1]);
  }
  return path;
}
function find(path, callback, errback) {
  // .js extensions are passed through as-is
  if (/\.js$/.test(path)) return get(path, callback, errback);
  // First look for /index.js
  // Then try looking for /package.json
  // Then try appending the .js extension
  get(path + "/index.js", callback, function () {
    get(path + "/package.json", function (jsonPath, json) {
      // Parse the JSON file
      var doc;
      try { doc = JSON.parse(json); }
      catch (err) { return errback(err); }
      // Abort if main is missing
      if (!doc.main) {
        return errback(new Error("Missing main field in " + jsonPath));
      }
      find(realPath(path + "/" + doc.main), callback, errback);
    }, function () {
      get(path + ".js", callback, function () {
        errback(new Error("Unable to find module: " + path));
      });
    });
  });
}
////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////
// Load loads a module and all it's dependencies, wraps them in AMD and inserts
// them as script tags.
function load(root, path, callback, errback) {
  resolve(root, path, function (realPath, contents) {
    process(realPath, contents, callback, errback);
  }, errback);
}
var defs = {};
require.defs = defs;
var defCallbacks = {};
window.define = define;
function define(path, deps, fn) {
  var def = { path: path, deps: deps, fn: fn };
  defs[path] = def;
  var callback = defCallbacks[path];
  delete defCallbacks[path];
  callback(def);
}
var processPending = {};
function process(path, contents, callback, errback) {
  if (path in defs) return callback(defs[path]);
  if (path in processPending) {
    return processPending[path].push([callback, errback]);
  }
  processPending[path] = [[callback, errback]];
  realProcess(path, contents, function (def) {
    defs[path] = def;
    flush(null, def);
  }, flush);
  function flush(err, def) {
    var pending = processPending[path];
    delete processPending[path];
    pending.forEach(function (pair) {
      if (err) pair[1](err);
      else pair[0](def);
    });
  }
}
function realProcess(path, contents, callback, errback) {
  var failed;
  function fail(err) {
    if (failed) return;
    failed = true;
    errback(err);
  }
  // Scan for dependencies
  var root = path.match(/^(.*\/)[^\/]*$/)[1];
  var matches = mine(contents);
  var deps = [];
  if (!matches.length) return save();
  // If there are dependencies, load them first.
  var left = matches.length;
  for (var i = 0, l = left; i < l; i++) {
    var match = matches[i];
    resolve(root, match, onResolve, fail);
  }
  function onResolve(realPath, contents) {
    deps.push(realPath);
    process(realPath, contents, check, fail);
  }
  function check(dep) {
    deps.push(dep);
    if (--left) return;
    deps.sort();
    save();
  }

  function save() {
    // Wrap and save the file
    var wrappedjs = 'window.define(' + JSON.stringify(path) + ', ' + JSON.stringify(deps) +
      ', function (module, exports, require, __dirname, __filename) {\n' + contents + '\n});';
    writeFile(path.substr(1).replace(/\//g, "_"), wrappedjs, function (url) {
      defCallbacks[path] = callback;
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = url;
      document.head.appendChild(script);
    }, errback);
  }
}
// Mine a string for require calls and export the module names
// Extract all require calls using a proper state-machine parser.
function mine(js) {
  var names = [];
  var state = 0;
  var ident;
  var quote;
  var name;
  var states = [
    // 0 - START
    function (char) {
      if (char === "/") state = 6;
      else if (char === "'" || char === '"') {
        quote = char;
        state = 4;
      }
      else if (char === "r") {
        ident = char;
        state = 1;
      }
    },
    // 1 - IDENT
    function (char) {
      if (char === "require"[ident.length]) {
        ident += char;
      }
      else if (char === "(" && ident === "require") {
        ident = undefined;
        state = 2;
      }
      else {
        state = 0;
      }
    },
    // 2 - CALL
    function (char) {
      if (char === "'" || char === '"') {
        quote = char;
        name = "";
        state = 3;
      }
      else {
        state = 0;
      }
    },
    // 3 - NAME
    function (char) {
      if (char === quote) {
        names.push(name);
        name = undefined;
        state = 0;
      }
      else {
        name += char;
      }
    },
    // 4 - STRING
    function (char) {
      if (char === "\\") {
        state = 5;
      }
      else if (char === quote) {
        state = 0;
      }
    },
    // 5 - ESCAPE
    function (char) {
      state = 4;
    },
    // 6 - SLASH
    function (char) {
      if (char === "/") state = 7;
      else if (char === "*") state = 8;
      else state = 0;
    },
    // 7 - LINE_COMMENT
    function (char) {
      if (char === "\r" || char === "\n") state = 0;
    },
    // 8 - MULTILINE_COMMENT
    function (char) {
      if (char === "*") state = 9;
    },
    // 9 - MULTILINE_ENDING
    function (char) {
      if (char === "/") state = 0;
      else if (char !== "*") state = 8;
    }
  ];
  for (var i = 0, l = js.length; i < l; i++) {
    states[state](js[i]);
  }
  return names;
}
////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////
var modules = {};
require.modules = modules;
function realRequire(root, path) {
  var realPath = mappings[root + ":" + path];
  if (!realPath) throw new Error("Can't require sync yet: " + path + " in " + root);
  var def = defs[realPath];
  if (!def) throw new Error("Missing definition for: " + realPath);
  return start(def);
}
function realRequireAsync(root, path, callback, errback) {
  load(root, path, function (def) {
    var module;
    try {
      module = start(def);
    }
    catch (err) {
      return errback(err);
    }
    callback(module);
  }, errback);
}

function start(def) {
  var pathname = def.path;
  var dirname = pathname.match(/^(.*\/)[^\/]*$/)[1];
  var require = makeRequire(dirname);
  var exports = {};
  var module = {exports: exports};
  delete defs[pathname];
  modules[pathname] = exports;
  def.fn(module, exports, require, dirname, pathname);
  modules[pathname] = module.exports;
  return module.exports;
}

}());
