# make-vfs

Easily make a virtual filesystem from a directory.

- Create a typescript module that imports all your filesystem routes
- Create a javascript module that contains the content of all of your migrations

See some examples of what a [vfs module looks like here](https://github.com/seveibar/make-vfs/blob/main/tests/snapshots/generate-vfs-module.test.ts.md#L1)

## Usage

```bash

```

### Embedding as Part of a Build System

`make-vfs` can be embedded as part of your build system. For example, maybe
you want to build an application with filesystem routes, after creating a new
route or as a prebuild step you would just run `make-vfs ./src/routes ./src/routes.generated.ts`
e.g. inside a package.json `prebuild` script.
