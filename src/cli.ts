import { getVirtualFilesystemModuleFromDirPath } from "index"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const argv = yargs(hideBin(process.argv))
  .option("dir", {
    type: "string",
    description: "The directory to load files from",
  })
  .option("extensions", {
    type: "string",
    description: "Valid extensions to write into vfs module",
  })
  .option("outfile", {
    type: "string",
    description: "The output vfs module file e.g. vfs.ts or migrations.ts",
  })
  .option("no-import-ext", {
    type: "boolean",
    description: "Do not add the extension to the import path",
  })
  .option("content-format", {
    type: "string",
    choices: ["buffer", "string", "import-star", "import-default", "require"],
    default: "buffer",
    description: "The format to store files in the vfs module.",
  })
  .example(
    "make-vfs ./migrations --extensions sql --content-format=string ./migrations.ts",
    "Put all your migrations into a typescript module"
  )
  .example(
    "make-vfs ./routes --extensions ts,js ./routes.generated.ts --content-format=import-default --no-import-ext",
    "Put all your filesystem routes into a typescript module"
  ).argv as any

async function main() {
  let dir: string = argv.dir ?? argv._[0]
  let outfile: string = argv.outfile ?? argv._[0]

  let extensions: string[] | undefined = undefined
  if (argv.extensions) extensions = argv.extensions.split(",")

  console.log(argv)

  console.log(
    await getVirtualFilesystemModuleFromDirPath({
      dirPath: dir,
      extensions,
      contentFormat: argv.contentFormat,
      targetPath: outfile,
      noImportExt: argv.noImportExt,
    })
  )
}

main()
