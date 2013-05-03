(function () {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('autorequire', "/app/main.js");
  script.setAttribute('moduledir', "/modules/");
  script.src = "/app/module.js";
  document.head.appendChild(script);
}());

// chrome.app.runtime.onLaunched.addListener(function() {
//   chrome.app.window.create('/app/index.html', {
//     'width': 800,
//     'height': 600
//   });
// });
