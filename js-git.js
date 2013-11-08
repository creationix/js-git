var fetch = require('./lib/fetch.js');
var push = require('./lib/push.js');

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

  // Mix in the walker helpers
  require('./mixins/walkers.js')(repo);

  // Mix in packfile import and export ability
  require('./mixins/packops.js')(repo);

  // Git Objects

  // Network Protocols
  repo.fetch = fetch;
  repo.push = push;

  return repo;



}
