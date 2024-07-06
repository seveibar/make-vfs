# make-vfs

Easily make a virtual filesystem from a directory.

- Create a typescript module that imports all your filesystem routes
- Create a javascript module that contains the content of all of your migrations

See some examples of what a [vfs module looks like here](https://github.com/seveibar/make-vfs/blob/main/tests/snapshots/generate-vfs-module.test.ts.md#L1)

## Usage

```
$ make-vfs --help
Options:
  --help            Show help                                          [boolean]
  --version         Show version number                                [boolean]
  --dir             The directory to load files from                    [string]
  --extensions      Valid extensions to write into vfs module           [string]
  --outfile         The output vfs module file e.g. vfs.ts or migrations.ts
                                                                        [string]
  --no-import-ext   Do not add the extension to the import path        [boolean]
  --content-format  The format to store files in the vfs module.
         [string] [choices: "buffer", "string", "import-star", "import-default",
                                                  "require"] [default: "buffer"]

Examples:
  make-vfs ./migrations --extensions sql    Put all your migrations into a
  --content-format=string ./migrations.ts   typescript module
  make-vfs ./routes --extensions ts,js      Put all your filesystem routes into
  ./routes.generated.ts                     a typescript module
  --content-format=import-default
  --no-import-ext
```

### Statically Bundling Routes

A common use-case for `make-vfs` is to statically bundle all the routes in a directory so that
a server can be packaged without needing to do runtime filesystem operations.

To do this, you can add an npm script `build:routes` that generates a `static-routes.ts` file
that imports all your route files. The script can be defined as...

```
make-vfs --dir ./routes --content-format import-star --outfile static-routes.ts
```

It will generate something like:

```ts
import * as _api_dev_package_examples_create from "./../routes/api/dev_package_examples/create"
import * as _api_dev_package_examples_get from "./../routes/api/dev_package_examples/get"
import * as _api_health from "./../routes/api/health"

export default {
  "api/dev_package_examples/create": _api_dev_package_examples_create,
  "api/dev_package_examples/get": _api_dev_package_examples_get,
  "api/health": _api_health
}
```

You can now use your routes statically, e.g. here's a simple web server using bun using the
statically generated routes:

```ts
// server.ts
import staticRoutes from "./static-routes"

Bun.serve({
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.slice(1); // Remove leading slash
    
    if (!(path in staticRoutes)) {
      return new Response("Not found", { status: 404 });
    }

    const route = staticRoutes[path]
    return route.default(req)
  },
  port: 3000,
})
```

> [!NOTE]
> An example of a route file would be something like:
> ```ts
> export default (req) => {
>   return new Response("hello world!")
> }


### Statically Bundling Files

You can also use `make-vfs` to generate a Typescript file that contains buffers
or string representations of files such as images, markdown etc.

```sh
make-vfs --dir ./assets --content-format buffer --outfile bundle.js

# If you're only bundling text files, use the "string" output format so you don't
# need to deal with buffers!
make-vfs --dir ./assets --content-format string --outfile bundle.js
```

The output format for these is just an object a `buffer` or `string` as values (depending
on your selected `--content-format`)

```ts
export default {
  "assets/file.txt": "hello world!",
  "assets/some-other-file.md": "#Some Other File\nContent goes here"
}
```

You can now import and use this file!

### Usage as Library

```ts
import {
  getVirtualFilesystemModuleFromDirPath,
  getVirtualFileSystemFromDirPath,
  getMatchingFilePaths,
} from "./index"

const moduleString = await getVirtualFilesystemModuleFromDirPath({
  dir: "./migrations",
  extensions: ["sql"],
  outfile: "./migrations.ts",
  contentFormat: "string",
})
/*
export default {
  "0001_initial_migration": "CREATE TABLE users (id serial primary key)",
  "0002_add_email_to_users": "ALTER TABLE users ADD COLUMN email text",
}
*/
```

### Embedding as Part of a Build System

`make-vfs` can be embedded as part of your build system. For example, maybe
you want to build an application with filesystem routes, after creating a new
route or as a prebuild step you would just run `make-vfs ./src/routes ./src/routes.generated.ts`
e.g. inside a package.json `prebuild` script.

```json
{
  "scripts": {
    "prebuild": "make-vfs --dir ./src/routes --content-format string --outfile asset-bundle.js"
  }
}
```
