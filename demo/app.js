
// These 3 functions make using async function in the repl easier.  If no
// callback is specefied, they log the result to the console.

// Wrap a 1 parameter async function for easy repl use.
function log(err) {
  if (err) throw err;
  console.log.apply(console, Array.prototype.slice.call(arguments, 1));
}
// Repl wRap 2-arg
function rr2(fn) {
  return function (arg1, arg2, callback) {
    return fn(arg1, arg2, callback || log);
  };
}
// Repl wRap 1-arg
function rr1(fn) {
  return function (arg, callback) {
    return fn(arg, callback || log);
  };
}
// Repl wRap 0-args
function rr0(fn) {
  return function (callback) {
    return fn(callback || log);
  };
}

// Note: The file system has been prefixed as of Google Chrome 12:
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

window.requestFileSystem(window.PERSISTENT, null, function (fileSystem) {
  function readfile(path, callback) {
    callback(new Error("TODO: Implement readfile"));
  }
  function writefile(path, contents, callback) {
    callback(new Error("TODO: Implement writefile"));
  }
  function rmfile(path, callback) {
    callback(new Error("TODO: Implement writefile"));
  }
  function readdir(path, callback) {
    fileSystem.root.getDirectory(path, {create: false}, function (dirEntry) {
      var dirReader = dirEntry.createReader();
      var entries = [];
      readEntries();
      function readEntries() {
        dirReader.readEntries(function (results) {
          if (!results.length) {
            callback(null, entries);
          }
          else {
            entries = entries.concat(Array.prototype.slice.call(results).map(function (entry) {
              return entry.name;
            }));
            readEntries();
          }
        }, callback);
      }
    }, callback);
  }
  function mkdir(path, callback) {
    fileSystem.root.getDirectory(path, {create: true}, function () {
      callback();
    }, callback);
  }
  function rmdir(path, callback) {
    fileSystem.root.getDirectory(path, {}, function (dirEntry) {
      dirEntry.removeRecursively(function () {
        callback();
      }, callback);
    }, callback);
  }
  function copy(source, dest, callback) {
    callback(new Error("TODO: Implement copy"));
  }
  function move(source, dest, callback) {
    callback(new Error("TODO: Implement move"));
  }

  window.fs = {
    readfile: rr1(readfile),
    writefile: rr2(writefile),
    rmfile: rr1(rmfile),
    readdir: rr1(readdir),
    mkdir: rr1(mkdir),
    rmdir: rr1(rmdir),
    copy: rr2(copy),
    move: rr2(move),
  };
}, function (fileError) {
  var msg = '';

  switch (fileError.code) {
    case window.FileError.QUOTA_EXCEEDED_ERR:
      msg = 'QUOTA_EXCEEDED_ERR';
      break;
    case window.FileError.NOT_FOUND_ERR:
      msg = 'NOT_FOUND_ERR';
      break;
    case window.FileError.SECURITY_ERR:
      msg = 'SECURITY_ERR';
      break;
    case window.FileError.INVALID_MODIFICATION_ERR:
      msg = 'INVALID_MODIFICATION_ERR';
      break;
    case window.FileError.INVALID_STATE_ERR:
      msg = 'INVALID_STATE_ERR';
      break;
    default:
      msg = 'Unknown Error';
      break;
  }

  console.error("Problem getting fs", msg);
});


window.env = {};
window.db = {};



console.log("Welcome to the js-git demo.  There are some global objects you can use to manupulate the sandbox.  They are `fs`, `git`, `env`, and `db`.  Use autocomplete to explore their capabilities");
