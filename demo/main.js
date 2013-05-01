require('html5fs.js')(function (err, fs) {
  if (err) throw err;
  window.fs = fs;
});


// 
// 
// getFs();
// 

// }
// 
// function getDb() {
// 
//   function fsDb(fs, path, callback) {
//     function get(key, callback) {
//       fs.readfile("/.gitdb/" + key, callback || log);
//     }
//     function set(key, value, callback) {
//       fs.writefile("/.gitdb/" + key, value, callback || log);
//     }
//     fs.mkdir("/.gitdb", function (err) {
//       if (err) return callback(err);
//       callback(null, {
//         get: get,
//         set: set
//       });
//     });
//   }
// 
//   fsDb(window.fs, "/.gitdb", function (err, db) {
//     window.db = db;
//     getTempFs();
//   });
// }
// 
// function getTempFs() {
//   window.requestFileSystem(window.TEMPORARY, null, function (fileSystem) {
//     window.tfs = wrapFileSystem(fileSystem);
//     getGit();
//   }, function (fileError) {
//     throw new Error("Problem temporary fs: " + formatError(fileError));
//   });
// }
// 
// function getGit() {
//   
//   function define(name, deps, def) {
//     console.log("register", arguments);
//   }
//   window.define = define;
// 
//   function load(path, callback) {
//     get(path, function (err, js) {
//       if (err) return callback(err);
//       if (path[0] === "/") path = path.substr(1);
//       var safePath = "/" + path.replace(/\//g, "_");
//       var wrappedjs =
//         'window.define(' + JSON.stringify(safePath) + ', [], function (module, exports, require) {\n\n' +
//         js + '\n\n});';
//       window.tfs.writefile(safePath, wrappedjs, function (err, fileEntry) {
//         if (err) return callback(err);
//         callback(null, fileEntry.toURL(), wrappedjs);
//       });
//     });
//   }
//   
//   load("/square.js", function (err, url, js) {
//     if (err) throw err;
//     console.log({url:url, js:js});
//     var script = document.createElement('script');
//     script.type = 'text/javascript';
//     script.src = url;
//     document.head.appendChild(script);
//   });
// 
//   window.git = {};
//   start();
// }
// 
// function start() {
//   console.log("Welcome to the js-git demo.\n" +
//               "There are some global objects you can use to manupulate the sandbox.\n" +
//               "They are `fs`, `git`, and `db`.\n" +
//               "Use autocomplete to explore their capabilities");
// }
// 
// 
// 
// 
// 
