module.exports = urlParse;

function urlParse(url) {
  var protocol, user, pass, hostname, port, pathname, query;
  var match, host, path;
  if (match = url.match(/^(?:(wss?|https?|git|ssh):\/\/)([^\/]+)([^:]+)$/)) {
    protocol = match[1],
    host = match[2];
    path = match[3];
  }
  else if (match = url.match(/^(?:([^@]+)@)?([^:\/]+)([:\/][^:\/][^:]+)$/)) {
    protocol = "ssh";
    user = match[1];
    hostname = match[2];
    pathname = match[3];
  }
  else {
    throw new Error("Uknown URL format: " + url);
  }
  if (host) {
    match = host.match(/^(?:([^@:]+)(?::([^@]+))?@)?([^@:]+)(?::([0-9]+))?$/);
    user = match[1];
    pass = match[2];
    hostname = match[3];
    port = match[4];
  }
  if (path) {
    match = path.match(/^([^?]+)(?:\?(.*))?$/);
    pathname = match[1];
    query = match[2];
  }

  if (port) port = parseInt(port, 10);
  else if (protocol === "http" || protocol === "ws") port = 80;
  else if (protocol === "https" || protocol === "wss") port = 443;
  else if (protocol === "ssh") port = 22;
  else if (protocol === "git") port = 9418;

  var opt = {
    protocol: protocol
  };
  if (user) opt.user = user;
  if (pass) opt.pass = pass;
  opt.hostname = hostname;
  opt.port = port;
  opt.pathname = pathname;
  if (query) opt.query = query;

  return opt;
}
