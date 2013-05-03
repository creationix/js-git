(function () {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('autorequire', "/app/main.js");
  script.setAttribute('moduledir', "/deps/");
  script.src = "/deps/chrome-app-module-loader/module.js";
  document.head.appendChild(script);
}());

// // Also allow launching as a gui app.
// chrome.app.runtime.onLaunched.addListener(function() {
//   chrome.app.window.create('/app/index.html', {
//     'width': 800,
//     'height': 600
//   });
// });
