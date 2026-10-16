import { readFile, writeFile, unlink, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const arg = process.argv.indexOf('--repo')
const candidates = arg >= 0 ? [resolve(process.argv[arg + 1])] : process.env.DSH_REPO
  ? [resolve(process.env.DSH_REPO)]
  : ['../deepseek-harness', '../../deepseek-harness', '../../../deepseek-harness'].map(path => resolve(root, path))
let repo
for (const candidate of candidates) {
  try { await access(join(candidate, 'packages/core/system-prompt/lib/index.js')); repo = candidate; break } catch {}
}
if (!repo) throw Error('先构建 Harness，再用 npm run typecheck -- --repo <Harness目录> 指定源码位置')
const config = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'))
for (const key of Object.keys(config.compilerOptions.paths)) {
  config.compilerOptions.paths[key] = config.compilerOptions.paths[key]
    .map(path => join(repo, path.replace(/^\.\.\/\.\.\/deepseek-harness\//, '')))
}
const temporary = join(root, `.typecheck-${randomUUID()}.json`)
try {
  await writeFile(temporary, JSON.stringify(config))
  const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', temporary], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally { await unlink(temporary) }
