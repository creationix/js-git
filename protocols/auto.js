var tcpProto, smartHttpProto, sshProto;
module.exports = function (opts) {
  if (opts.protocol === "git:") {
    tcpProto = tcpProto || require('./tcp.js');
    return(tcpProto(opts));
  }
  if (opts.protocol === "http:") {
    smartHttpProto = smartHttpProto || require('./smart-http.js');
    return(smartHttpProto(opts));
  }
  if (opts.protocol === "https:") {
    opts.tls = true;
    smartHttpProto = smartHttpProto || require('./smart-http.js');
    return(smartHttpProto(opts));
  }
  if (opts.protocol === "ssh:") {
    sshProto = sshProto || require('./ssh.js');
    return(sshProto(opts));
  }
  throw new TypeError("Unknown protocol " + opts.protocol);
};
