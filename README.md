# JS Git

[![node support](https://travis-ci.org/creationix/js-git.png)](https://travis-ci.org/creationix/js-git)

[![browser support](https://ci.testling.com/creationix/js-git.png)](https://ci.testling.com/creationix/js-git)

This is a pure JavaScript implementation of the [git][] version control system for use from various JavaScript environments.  Goals are to target environments like [node.js][], [chrome packaged apps][], HTML5 webapps, WinJS apps, FirefoxOS apps, etc...

![JS Git](https://s3.amazonaws.com/ksr/projects/487331/photo-main.jpg)


## Modules

This repository is a meta-package of js-git related modules.  It's packaged as a common-js package and can be used in browser environments with tools like [browserify][]

### pkt-line

This module contains pkt-line deframer and framer as min-stream-push-filters.

 - `pktLine.deframer(emit)` -> `emit`
 - `pktLine.framer(emit)` -> `emit`

## Related Packages

Not all parts of js-git are in this package.  Of node, the min-stream code is already factored out into several standalone packages.

 - [min-stream][] - Helpers for working with min-streams.
 - [min-stream-node][] - A node.js adapter that provides tcp client and server as well as file streams using min-streams.
 - [min-stream-uv][] - A crazy experiment to implement the same interface as min-stream-node, but using node's private internal libuv bindings for maximum speed and unstability.
 - [min-stream-chrome][] - Another implementation of the tcp and fs API, but wrapping chrome packaged apps's special APIs.
 - [min-stream-http-codec][] - A set of filters that makes implementing HTTP clients and servers easy.

## Projects using JS-Git

 - [js-git-app][] - A chrome packaged app used to demo/test using js-git in a chrome environment.
 - [js-git-node][] - A node CLI tool used to demo/test using js-git in the node.js environment.

[node.js]: http://nodejs.org
[git]: http://git-scm.com/
[browserify]: http://browserify.org/
[chrome packaged apps]: http://developer.chrome.com/apps/
[min-stream]: https://github.com/creationix/min-stream
[min-stream-node]: https://github.com/creationix/min-stream-node
[min-stream-uv]: https://github.com/creationix/min-stream-uv
[min-stream-chrome]: https://github.com/creationix/min-stream-chrome
[min-stream-http-codec]: https://github.com/creationix/min-stream-http-codec
[js-git-app]: https://github.com/creationix/js-git-app
[js-git-node]: https://github.com/creationix/js-git-node
