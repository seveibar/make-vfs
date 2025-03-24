import test from "ava"
import { getVirtualFileSystemFromDirPath } from "index"
import fs from "fs/promises"
import path from "path"
import os from "os"

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vfs-test-'))
  return tempDir
}

const setupTestDir = async (basePath: string, files: Record<string, string>) => {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(basePath, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content)
  }
}

test("generate vfs from directory", async (t) => {
  const basePath = await createTempDir()
  await setupTestDir(basePath, {
    'file1.txt': 'this is file1 content',
    'file2.js': 'console.log("hello world")',
    'file3.png': 'should not include'
  })
  
  const vfs = await getVirtualFileSystemFromDirPath({
    dirPath: basePath,
    extensions: ["txt", "js"],
  })

  t.is(vfs["file1.txt"], "this is file1 content")
  t.is(vfs["file2.js"], 'console.log("hello world")')
  t.falsy(vfs["file3.png"])
  t.is(Object.keys(vfs).length, 2)

  await fs.rm(basePath, { recursive: true, force: true })
})

test("generate vfs from directory with Windows paths", async (t) => {
  const basePath = await createTempDir()
  await setupTestDir(basePath, {
    'file1.txt': 'this is file1 content',
    'file2.js': 'console.log("hello world")',
    'file3.png': 'should not include'
  })
  
  const vfs = await getVirtualFileSystemFromDirPath({
    dirPath: basePath,
    extensions: ["txt", "js"],
  })

  t.is(vfs["file1.txt"], "this is file1 content")
  t.is(vfs["file2.js"], 'console.log("hello world")')
  t.falsy(vfs["file3.png"])
  t.is(Object.keys(vfs).length, 2)

  await fs.rm(basePath, { recursive: true, force: true })
})

test("generate vfs from directory with nested Windows paths", async (t) => {
  const basePath = await createTempDir()
  await setupTestDir(basePath, {
    'nested/file1.txt': 'nested file1 content',
    'nested/deeper/file2.js': 'console.log("nested")'
  })
  
  const vfs = await getVirtualFileSystemFromDirPath({
    dirPath: basePath,
    extensions: ["txt", "js"],
  })

  t.is(vfs["nested/file1.txt"], "nested file1 content")
  t.is(vfs["nested/deeper/file2.js"], 'console.log("nested")')
  t.is(Object.keys(vfs).length, 2)

  await fs.rm(basePath, { recursive: true, force: true })
})
