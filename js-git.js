
var treeWalk = require('./lib/tree-walk.js');
var logWalk = require('./lib/log-walk.js');
var fetch = require('./lib/fetch.js');
var push = require('./lib/push.js');
var unpack = require('./lib/unpack.js');

module.exports = newRepo;

function newRepo(db) {
  if (!db) throw new TypeError("A db interface instance is required");

  var repo = {};

  // Auto trace the db if tracing is turned on.
  if (require('./lib/trace.js')) db = require('./lib/tracedb.js')(db);

  // Add the db interface (used by objects, refs, and unpack mixins)
  repo.db = db;

  // Mix in object store interface
  require('./mixins/objects.js')(repo);

  // Mix in the references interface
  require('./mixins/refs.js')(repo);

  // Git Objects
  repo.unpack = unpack;   // (opts, packStream)

  // Convenience Readers
  repo.logWalk = logWalk;   // (hash-ish) => stream<commit>
  repo.treeWalk = treeWalk; // (hash-ish) => stream<object>


  // Network Protocols
  repo.fetch = fetch;
  repo.push = push;

  return repo;



}
