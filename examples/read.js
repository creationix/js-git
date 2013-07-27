// Inject the dependencies to fsDb to work using node.js
var platform = require('./node');
// And create a db instance
var db = require('../lib/fs-db.js')(platform)("test.git", true);
// And wrap in a repo API
var repo = require('../lib/repo.js')(db);

console.log("Looking up hash that HEAD points to...");
repo.getHead(function (err, head) {
  if (err) throw err;

  console.log("Walking linear commit history back to first commit...");
  repo.loadCommit(head, function (err, commit) {
    if (err) throw err;
    console.log("\n\nCommit: " + )
  });


});
