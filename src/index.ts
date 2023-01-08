import glob from "glob-promise"
import mkdirp from "mkdirp"
import path from "path"
import prettier from "prettier"
import { existsSync } from "fs"
import fs from "fs/promises"

type Path = string
type Content = Buffer | string
type ContentFormat =
  | "buffer"
  | "string"
  | "import-star"
  | "import-default"
  | "require"

interface SearchOpts {
  dirPath: string
  targetPath?: string
  extensions?: string[]
  fileMatchFn?: (filename: string, path: string) => boolean
  contentFormat?: ContentFormat
  noImportExt?: boolean
}

function idsafe(s: string) {
  return "_" + s.replace(/[^a-zA-Z0-9]/g, "_")
}

export const getMatchingFilePaths = async ({
  dirPath,
  extensions,
  fileMatchFn,
}: SearchOpts) => {
  if (extensions && fileMatchFn)
    throw new Error(`Cannot provide extensions and fileMatchFn`)
  if (extensions) {
    fileMatchFn = (filename) =>
      extensions.some((ext) => filename.endsWith(`.${ext}`))
  }
  if (!fileMatchFn) fileMatchFn = () => true
  return (await glob("**/*", { cwd: dirPath, nodir: true })).filter(
    (filename) => fileMatchFn!(filename, path.resolve(dirPath, filename))
  )
}

export const getVirtualFileSystemFromDirPath = async (
  opts: SearchOpts
): Promise<Record<Path, Content>> => {
  const { dirPath, contentFormat } = opts
  const filePaths = await getMatchingFilePaths(opts)
  const vfs: Record<Path, Content> = {}
  for (const filePath of filePaths) {
    vfs[filePath] = await fs.readFile(path.resolve(dirPath, filePath))
  }
  return vfs
}

export const getVirtualFilesystemModuleFromDirPath = async (
  opts: SearchOpts
): Promise<string> => {
  const vfs = await getVirtualFileSystemFromDirPath(opts)
  const cf = opts.contentFormat

  switch (cf ?? "buffer") {
    case "buffer":
    case "string": {
      return (
        `export default {\n` +
        Object.entries(vfs)
          .map(([path, content]) =>
            cf === "buffer"
              ? `  "${path}": Buffer.from("${content.toString("base64")}")`
              : `  "${path}": Buffer.from("${content.toString(
                  "base64"
                )}", "utf8")`
          )
          .join(",\n") +
        `\n}`
      )
    }
    case "require":
    case "import-default":
    case "import-star": {
      if (!opts.targetPath)
        throw new Error(
          `targetPath is required when using content-format of require,import-default,import-star`
        )
      const basePath = path.relative(
        path.dirname(opts.targetPath),
        opts.dirPath
      )
      let fps = Object.keys(vfs)
      if (opts.noImportExt) {
        fps = fps.map((fp) => fp.replace(/\.[^.]+$/, ""))
      }
      return (
        `${fps
          .map((fp) =>
            cf === "require"
              ? `const ${idsafe(fp)} = require("./${path.join(basePath, fp)}")`
              : cf === "import-default"
              ? `import ${idsafe(fp)} from "./${path.join(basePath, fp)}"`
              : `import * as ${idsafe(fp)} from "./${path.join(basePath, fp)}"`
          )
          .join("\n")}\n\n` +
        `export default {\n` +
        fps.map((fp) => `  "${fp}": ${idsafe(fp)}`).join(",\n") +
        `\n}`
      )
    }
  }
  throw new Error(`Unknown content format: ${cf}`)
}
