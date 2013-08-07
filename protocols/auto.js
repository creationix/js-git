module.exports = function (platform) {
  var tcpProto, smartHttpProto, sshProto;

  return function (opts) {
    if (opts.protocol === "git:") {
      tcpProto = tcpProto || require('./tcp.js')(platform);
      return(tcpProto(opts));
    }
    if (opts.protocol === "http:") {
      smartHttpProto = smartHttpProto || require('./smart-http.js')(platform);
      return(smartHttpProto(opts));
    }
    if (opts.protocol === "https:") {
      opts.tls = true;
      smartHttpProto = smartHttpProto || require('./smart-http.js')(platform);
      return(smartHttpProto(opts));
    }
    throw new TypeError("Unknown protocol " + opts.protocol);
  };
};
