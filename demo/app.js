
// These functions make using async function in the repl easier.  If no
// callback is specefied, they log the result to the console.

function log(err) {
  if (err) throw err;
  console.log.apply(console, Array.prototype.slice.call(arguments, 1));
}
function formatError(fileError) {
  switch (fileError.code) {
    case window.FileError.QUOTA_EXCEEDED_ERR: return 'QUOTA_EXCEEDED_ERR';
    case window.FileError.NOT_FOUND_ERR: return 'NOT_FOUND_ERR';
    case window.FileError.SECURITY_ERR: return 'SECURITY_ERR';
    case window.FileError.INVALID_MODIFICATION_ERR: return 'INVALID_MODIFICATION_ERR';
    case window.FileError.INVALID_STATE_ERR: return 'INVALID_STATE_ERR';
    default: return 'Unknown Error';
  }
}
function check(path, callback) {
  return function (err) {
    if (err && err instanceof window.FileError) {
      err.path = path;
      err.message = formatError(err) + " at '" + path + "'";
      console.error(err.message);
      callback(err);
    }
    else {
      callback.apply(this, arguments);
    }
  };
}
function rr2(fn) {
  return function (arg1, arg2, callback) {
    return fn(arg1, arg2, check(arg1, callback || log));
  };
}
function rr1(fn) {
  return function (arg, callback) {
    return fn(arg, check(arg, callback || log));
  };
}

// Note: The file system has been prefixed as of Google Chrome 12:
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;


function wrapFileSystem(fileSystem) {
  var cwd = fileSystem.root;
  var fs = {
    readfile: rr1(readfile),
    writefile: rr2(writefile),
    rmfile: rr1(rmfile),
    readdir: rr1(readdir),
    mkdir: rr1(mkdir),
    rmdir: rr1(rmdir),
    copy: rr2(copy),
    move: rr2(move),
    chdir: rr1(chdir),
    cwd: function () { return cwd.fullPath; }
  };

  function readfile(path, callback) {
    cwd.getFile(path, {}, function (fileEntry) {
      fileEntry.file(function (file) {
        var reader = new FileReader();
        reader.onloadend = function () {
          callback(null, this.result);
        };
        reader.readAsText(file);
      }, callback);
    }, callback);
  }

  function writefile(path, contents, callback) {
    cwd.getFile(path, {create: true}, function (fileEntry) {
      fileEntry.createWriter(function (fileWriter) {
        fileWriter.onwriteend = function () {
          callback();
        };
        fileWriter.onerror = callback;
        fileWriter.write(new Blob([contents], {type: 'text/plain'}));
      }, callback);
    }, callback);
  }
  function rmfile(path, callback) {
    cwd.getFile(path, {}, function (fileEntry) {
      fileEntry.remove(function () {
        callback();
      }, callback);
    }, callback);
  }
  function readdir(path, callback) {
    cwd.getDirectory(path, {}, function (dirEntry) {
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
              return entry.name + (entry.isDirectory ? "/" : "");
            }));
            readEntries();
          }
        }, callback);
      }
    }, callback);
  }
  function mkdir(path, callback) {
    cwd.getDirectory(path, {create: true}, function () {
      callback();
    }, callback);
  }
  function rmdir(path, callback) {
    cwd.getDirectory(path, {}, function (dirEntry) {
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
  function chdir(path, callback) {
    cwd.getDirectory(path, {}, function (dirEntry) {
      cwd = dirEntry;
      if (fs.onchdir) {
        fs.onchdir(cwd.fullPath);
      }
      callback();
    }, callback);
  }

  return fs;
}


window.requestFileSystem(window.PERSISTENT, null, function (fileSystem) {
  window.fs = wrapFileSystem(fileSystem);
}, function (fileError) {
  throw new Error("Problem getting fs: " + formatError(fileError));
});


window.env = {};
window.db = {};



console.log("Welcome to the js-git demo.  There are some global objects you can use to manupulate the sandbox.  They are `fs`, `git`, `env`, and `db`.  Use autocomplete to explore their capabilities");
