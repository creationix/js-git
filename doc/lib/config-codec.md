# Config Codec

This module implements a codec for reading and writing git config files (this
includes the .gitmodules file).  As far as I can tell, this is a variant of
the INI format.

## codec.decode(ini) -> config

Given the text of the config file, return the data as an object.

The following config:

```ini
[user]
  name = Tim Caswell
  email = tim@creationix.com
[color]
  ui = true
[color "branch"]
  current = yellow bold
  local = green bold
  remote = cyan bold
```

Will parse to this js object

```js
{
  user: {
    name: "Tim Caswell",
    email: "tim@creationix.com"
  },
  color: {
    ui: "true",
    branch: {
      current: "yellow bold",
      local: "green bold",
      remote: "cyan bold"
    }
  }
}
```

## codec.encode(config) -> ini

This reverses the conversion and writes a string from a config object.