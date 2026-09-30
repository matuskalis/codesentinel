// Runs the real CLI on a scratch copy of a fixture and renders the terminal session to HTML.
//
//   pnpm cli:build
//   node scripts/render-demo.mjs demo.html [font-dir]
//   npx playwright screenshot --viewport-size=830,700 --full-page file://$PWD/demo.html docs/demo.png
//
// Nothing is typed in by hand: every command below is executed, its real output and exit
// code are captured, and the prompt shows the real exit status of the previous command.
// docs/demo.png was rendered with IBM Plex Mono (SIL OFL 1.1), from @fontsource/ibm-plex-mono.
// Pass the directory holding ibm-plex-mono-latin-{400,500,600}-normal.woff2 to use it,
// otherwise the page falls back to the system monospace font.
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const [outFile, fontDir] = process.argv.slice(2)
if (!outFile) {
  console.error('usage: node scripts/render-demo.mjs <out.html> [font-dir]')
  process.exit(1)
}

const rootDir = path.resolve(import.meta.dirname, '..')
const cli = path.join(rootDir, 'dist', 'codesentinel.mjs')
if (!fs.existsSync(cli)) {
  console.error('dist/codesentinel.mjs is missing, run pnpm cli:build first')
  process.exit(1)
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesentinel-demo-'))
const binDir = path.join(workDir, 'bin')
const shopDir = path.join(workDir, 'shop')
fs.mkdirSync(binDir)
fs.writeFileSync(path.join(binDir, 'codesentinel'), `#!/bin/sh\nexec node "${cli}" "$@"\n`, { mode: 0o755 })
fs.cpSync(path.join(rootDir, 'fixtures', 'next-supabase-service-key-client'), shopDir, { recursive: true })

const commands = [
  'sed -n 5,8p app/page.tsx',
  'codesentinel scan .',
  "perl -pi -e 's/SUPABASE_SERVICE_ROLE/NEXT_PUBLIC_SUPABASE_ANON/' app/page.tsx",
  'codesentinel scan .',
]

const session = []
let previousExit = 0
for (const command of commands) {
  const run = spawnSync(command, {
    shell: true,
    cwd: shopDir,
    encoding: 'utf-8',
    env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
  })
  session.push({ command, output: run.stdout + run.stderr, previousExit })
  previousExit = run.status ?? 1
}
fs.rmSync(workDir, { recursive: true, force: true })

const SGR_CLASSES = { 1: 'b', 2: 'd', 31: 'red', 32: 'green', 33: 'yellow', 35: 'magenta', 36: 'cyan' }

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Characters outside ASCII come from a fallback font, so pin each one to a single cell.
function renderText(text) {
  return [...escapeHtml(text)].map(char => (char.charCodeAt(0) > 126 ? `<span class="g">${char}</span>` : char)).join('')
}

function ansiToHtml(text) {
  let html = ''
  let open = []
  let last = 0
  for (const match of text.matchAll(/\x1b\[([0-9;]*)m/g)) {
    html += renderText(text.slice(last, match.index))
    last = match.index + match[0].length
    const code = Number(match[1] || 0)
    if (code === 0) {
      html += '</span>'.repeat(open.length)
      open = []
    } else if (SGR_CLASSES[code]) {
      html += `<span class="${SGR_CLASSES[code]}">`
      open.push(code)
    }
  }
  return html + renderText(text.slice(last)) + '</span>'.repeat(open.length)
}

function renderPrompt({ command, previousExit }) {
  const status = previousExit === 0 ? '' : ` <span class="red">✖ ${previousExit}</span>`
  return `<span class="d">shop</span>${status} <span class="d">$</span> <span class="cmd">${escapeHtml(command)}</span>`
}

const finalStatus = previousExit === 0 ? '' : ` <span class="red">✖ ${previousExit}</span>`
const transcript = [
  ...session.map(step => {
    const output = ansiToHtml(step.output).replace(/\n+$/, '')
    return output ? `${renderPrompt(step)}\n${output}\n` : renderPrompt(step)
  }),
  `<span class="d">shop</span>${finalStatus} <span class="d">$</span> <span class="cursor"></span>`,
].join('\n')

function fontFace(weight) {
  const file = fontDir && path.join(fontDir, `ibm-plex-mono-latin-${weight}-normal.woff2`)
  if (!file || !fs.existsSync(file)) return ''
  const data = fs.readFileSync(file).toString('base64')
  return `@font-face{font-family:"IBM Plex Mono";font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2")}`
}

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>codesentinel demo</title>
<style>
${[400, 500, 600].map(fontFace).join('\n')}
:root{--bg:#09090b;--fg:#e4e4e7;--muted:#71717a;--red:#ef4444;--green:#22c55e;--yellow:#eab308;--magenta:#d946ef;--cyan:#38bdf8}
html,body{margin:0;background:var(--bg)}
body{padding:34px 40px 36px}
pre{margin:0;color:var(--fg);font:400 14px/1.5 "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-ligatures:none;tab-size:2}
.b{font-weight:600}.d{color:var(--muted)}.cmd{font-weight:500;color:#fafafa}
.red{color:var(--red)}.green{color:var(--green)}.yellow{color:var(--yellow)}.magenta{color:var(--magenta)}.cyan{color:var(--cyan)}
.g{display:inline-block;width:1ch;text-align:center;overflow:visible}
.cursor{display:inline-block;width:1ch;height:1.15em;vertical-align:text-bottom;background:var(--fg)}
</style>
<pre>${transcript}</pre>
</html>
`

fs.writeFileSync(outFile, html)
console.log(`wrote ${outFile}`)
