# JS-Git

JS-Git is an open source project implementing git client and server in pure JavaScript.

## Why Re-implement Git in JavaScript?

JavaScript has farther reach than any other programming language out there.  It can run on tablets, phones, laptops, Chromebooks, and pretty much anything that has a browser.  Also thanks to node.js, it can run in many headless server environments as well.

Git is an amazing tool for sharing code and data in a distributed manner.  Adding this to everyone's tool-chain will enable many great tools and products.

### Target Platforms

My goal is to target every platform that has enough primitives to make sense.  This includes:

 - ChromeOS Apps
 - Firefox OS Apps
 - Windows RT WinJS Apps
 - HTML5 Web Apps (on all modern browsers, including IE 10)
 - PhoneGap Apps
 - Desktop Chrome Apps
 - Anything else that has network access, persistent storage, and binary data support in JavaScript.

### Feature Goals

I don't intend to make a 100% clone of all the features of the official git program.  That would be insane and require a lot more money than I'm asking for.  My main goal is to enable the 90% case of interesting stuff:

 - Clone remote repositories to local storage over http, git, or ssh.
 - Make and commit local changes offline.
 - Manage tags and branches offline.
 - Push changes back up to remote repositories.
 - Serve git repositories over http, git, or ssh.
 - Be very modular so bits can be used by any software that needs them.

### Potential Products

Some example products that would be enabled by this are:

 - ChromeOS IDE for developing *on* Chromebooks.
 - Node.JS blog engine with git as the database.
 - Custom Git hosting using custom storage back-ends.
 - GIT CLI for restricted environments.
 - Standalone GIT GUI desktop app.
 - Git based deployment tools.
 - JavaScript package management for server and client.
 - Whatever else you come up with.

### For the Children

My main driving force is to build a programming environment to teach kids to program.  It needs to run on the devices that the kids already have.  There are many youths who have access to tablets or Chromebooks, but have no way to program properly on them.  I want to change this and give them the tools to eventually become professional programmers.

#### JS-Git in a Chrome App

One sample application that I'm using to test my code is known as [js-git-app][].

![JS-Git App](http://creationix.com/js-git-app.png)

This app is still in the early stages. It's available in the Chrome [app store][] to test on any device that has Chrome installed.

#### JS-Git as a Node.JS CLI Tool

Another sample usage is [js-git-node][].

![JS-Git Node Clone](http://creationix.com/js-git-node-clone.png)

This is a CLI tool that can replace a subset of the git command-line tool.  This is useful on platforms that have node.js, but it's still hard to install git. (windows, crosh shell, etc...)

## Related Packages

Not all parts of js-git are in this package.  Of note, the min-stream code is already factored out into several standalone packages.

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
[app store]: https://chrome.google.com/webstore/detail/js-git-test-app/gcipadbniegpaccphmnfnpgklahgennp
