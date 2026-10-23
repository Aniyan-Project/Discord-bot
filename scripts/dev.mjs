import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const demo = process.argv.includes('--demo')
const env = {
  ...process.env,
  NODE_ENV: 'development',
  ...(demo
    ? { DEMO_MODE: 'true', DATABASE_PATH: ':memory:', APP_URL: 'http://localhost:5173', HOST: '127.0.0.1' }
    : {}),
}
const children = [
  spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'watch', 'server/index.ts'], {
    cwd: root,
    env,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    cwd: root,
    env,
    stdio: 'inherit',
  }),
]
let exiting = false
function close(code = 0) {
  if (exiting) return
  exiting = true
  for (const child of children) child.kill()
  process.exitCode = code
}
for (const child of children) child.on('exit', (code) => close(code ?? 1))
process.on('SIGINT', () => close())
process.on('SIGTERM', () => close())
