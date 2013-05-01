// Load the module system manually so we can load other stuff easier.
window.modulesReady = start;
(function () {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = "module.js";
  document.head.appendChild(script);
}());

function start() {
  require.async("main.js", function (err) {
    if (err) throw err;
  });
}
