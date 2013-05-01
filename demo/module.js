(function () {

"use strict";
window.define = define;
window.require = makeRequire("/");
window.require.resolve = resolve;

var defs = {};
var modules = {};
var fs;
(window.requestFileSystem || window.webkitRequestFileSystem)(window.TEMPORARY, null, function (fileSystem) {
  fs = fileSystem;
  window.modulesReady();
}, function (fileError) {
  throw new Error("Unable to create temporary fs for module loader: " + fileError);
});


// Root is always an absolute path starting and ending with a `/`
// path is the actual string used in require.
// If path starts with a `/`, then it's an absolute require.
// If paths starts with a `.`, then it's a relative require.
// Otherwise it's a module path and we must search for it.
// We also want to support optional extensions, loading json files, and
// parsing package.json looking for main.
// callback(realPath, contents) or errback(err) are the output.
var mappings = {};
function resolve(root, path, callback, errback) {
  var key = root + ":" + path;
  if (key in mappings) {
    return callback(mappings[key][0], mappings[key][1]);
  }
  function success(realPath, contents) {
    mappings[key] = [realPath, contents];
    callback(realPath, contents);
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

// unify a path
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
  // Then try looking for package.json
  // Then try appending the .js extension
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
}

function makeRequire(root) {
function require(path) {
  var key = root + ":" + path;
  if (!(key in mappings)) {
    throw new Error("Can't load module sychronously: " + key);
  }
  return realRequire(mappings[key]);
}
function requireAsync(path, callback) {
  resolve(root, path, function (path) {
    realRequireAsync(path, callback);
  }, callback);
}
require.async = requireAsync;
return require;
}

// basic xhr get
function get(path, callback, errback) {
  var request = new XMLHttpRequest();
  request.onload = function () {
    callback(path, this.responseText);
  };
  request.onerror = function () {
    errback(this);
  };
  request.open("GET", path, true);
  request.send();
}

function writeFile(path, contents, callback, errback) {
  fs.root.getFile(path, {create: true}, function (fileEntry) {
    fileEntry.createWriter(function (fileWriter) {
      fileWriter.onwriteend = function () {
        callback(fileEntry);
      };
      fileWriter.onerror = errback;
      fileWriter.write(new Blob([contents], {type: 'text/plain'}));
    }, errback);
  }, errback);        
}

function process(path, js) {
  console.log("TODO: process", {path:path, js:js});
  // TODO: look for dependencies in js and load them too.
}

// Load a script from disk and place in the temporary filesystem.
function realLoad(path, callback, errback) {
  get(path, function (path, js) {
    process(path, js);
    var wrappedjs =
      'window.define(' + JSON.stringify(path) + ', function (module, exports, require, __dirname, __filename) {\n' +
      js + '\n});';
    // Write the wrapped file to the temporary filesystem.
    writeFile(path.substr(1).replace(/\//g, "_"), wrappedjs, function (fileEntry) {
      callback(fileEntry.toURL());
    }, errback);
  }, errback);
}

// A concurrency safe version of load.
var urls = {};
var loadPending = {};
function load(path, callback, errback) {
  // Check for cached values and short-circuit.
  if (path in urls) {
    return callback(null, urls[path]);
  }
  // Check for other concurrent loads and piggyback.
  if (path in loadPending) {
    return loadPending[path].push([callback, errback]);
  }
  loadPending[path] = [[callback, errback]];
  realLoad(path, function (url) {
    urls[path] = url;
    flush(null, url);
  }, flush);
  function flush(err, url) {
    var pending = loadPending[path];
    delete loadPending[path];
    console.log("FLUSH", arguments);
    pending.forEach(function (pair) {
      if (url) pair[0](url);
      else pair[1](err);
    });
  }
}

function define(path, fn) {
  defs[path] = fn;
}

function start(path) {
  var pathname = "/" + path;
  var dirname = pathname.match(/^(.*\/)[^\/]*$/)[1];
  var require = makeRequire(dirname);
  var exports = {};
  var module = {exports: exports};
  var def = defs[path];
  delete defs[path];
  modules[path] = exports;
  def(module, exports, require, dirname, pathname);
  modules[path] = module.exports;
  return module.exports;  
}

// This is an absolute path, the require within modules is relative;
function realRequire(path) {
  if (path in defs) {
    try {
      start(path);
    }
    catch (err) {
      delete defs[path];
      throw err;
    }
  }
  if (path in modules) {
    return modules[path];
  }
  throw new Error("Module not found using sync: " + path);
}

function realRequireAsync(path, callback) {
  // already loaded modules short-circuit
  if (path in defs) {
    try {
      start(path);
    }
    catch (err) {
      delete defs[path];
      return callback(err);
    }
  }
  if (path in modules) {
    return callback(null, modules[path]);
  }
  load(path, function (url) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    document.head.appendChild(script);    
  }, callback);
}

}());
