import glob from "glob-promise"
import mkdirp from "mkdirp"
import path from "path"
import prettier from "prettier"
import { existsSync } from "fs"
import fs from "fs/promises"

const charsSafeToLeaveEncoded = "{}.,<>?/:'[]!@#$^&*() -_=+".split("")
const replaceSafeEncodedChars = (s: string) => {
  for (const char of charsSafeToLeaveEncoded) {
    if (char === encodeURIComponent(char)) continue
    s = s.replace(new RegExp(encodeURIComponent(char), "g"), char)
  }
  return s
}

type Path = string
type Content = Buffer | ArrayBuffer | string
type ContentFormat =
  | "buffer"
  | "string"
  | "arraybuffer"
  | "import-star"
  | "import-default"
  | "require"
  | "export-pathlist"
  | "import-bunfile"

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

// Helper function to normalize paths to posix style
const toPosixPath = (pathStr: string) => {
  if (!pathStr) return pathStr
  // Remove drive letter if present (e.g., C:)
  pathStr = pathStr.replace(/^[A-Za-z]:/, '')
  return pathStr.split(path.sep).join('/')
}

// Helper to join paths and normalize to posix
const joinPath = (...parts: string[]) => {
  return toPosixPath(path.join(...parts))
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

  const files = await glob("**/*", { 
    cwd: dirPath,
    nodir: true,
    dot: true,
    absolute: false,
    windowsPathsNoEscape: true
  })
  
  return files
    .map(f => toPosixPath(f))
    .filter(filename => fileMatchFn!(filename, path.join(dirPath, filename)))
}

export const getVirtualFileSystemFromDirPath = async (
  opts: SearchOpts
): Promise<Record<Path, Content>> => {
  const { dirPath, contentFormat = "string" } = opts
  const filePaths = await getMatchingFilePaths(opts)
  const vfs: Record<Path, Content> = {}
  
  for (const filePath of filePaths) {
    const fullPath = path.join(dirPath, filePath)
    const content = await fs.readFile(fullPath)
    const normalizedPath = toPosixPath(filePath)
    vfs[normalizedPath] = content.toString()
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
          .map(([filePath, content]) =>
            cf === "buffer"
              ? `  "${toPosixPath(filePath)}": Buffer.from("${content.toString(
                  "base64"
                )}", "base64")`
              : `  "${toPosixPath(filePath)}": decodeURIComponent("${replaceSafeEncodedChars(
                  encodeURIComponent(content.toString())
                )}")`
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
    case "arraybuffer": {
      throw new Error(`arraybuffer not yet implemented, contributions welcome`)
    }
    case "export-pathlist": {
      return (
        `export default [\n` +
        Object.keys(vfs)
          .map((path) => `  "${path}"`)
          .join(",\n") +
        `\n]`
      )
    }
    case "import-bunfile": {
      if (!opts.targetPath)
        throw new Error(
          `targetPath is required when using content-format of require,import-default,import-star`
        )
      const basePath = path.relative(
        path.dirname(opts.targetPath),
        opts.dirPath
      )
      let fps = Object.keys(vfs)
      return (
        `${fps
          .map(
            (fp) =>
              `import ${idsafe(fp)} from "./${path.join(
                basePath,
                fp
              )}" with { type: "file" };`
          )
          .join("\n")}\n\n` +
        'import { file } from "bun";\n\n' +
        `export default {\n` +
        fps.map((fp) => `  "${fp}": file(${idsafe(fp)})`).join(",\n") +
        `\n}`
      )
    }
  }
  throw new Error(`Unknown content format: ${cf}`)
}
