"use strict";

require('html5fs.js')(function (err, fs) {
  if (err) throw err;
  window.fs = fs;
  require('html5fsdb.js')(fs, "/.gitdb", function (err, db) {
    if (err) throw err;
    window.db = db;
  });
});

console.log(
  "Welcome to the js-git demo.\n" +
  "There are some global objects you can use to manupulate the sandbox.\n" +
  "They are `fs`, `git`, and `db`.\n" +
  "Use autocomplete to explore their capabilities"
);

