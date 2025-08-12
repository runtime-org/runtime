// scripts/make-latest-json.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { basename } from 'node:path'
import fg from 'fast-glob'

function readVersion() {
  // prefer env APP_VERSION, else read from tauri.conf.json
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  const cfg = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
  if (cfg.version) return cfg.version
  throw new Error('APP_VERSION not set and no "version" in src-tauri/tauri.conf.json')
}

function env(name, fallback) {
  const v = process.env[name]
  if (!v && fallback === undefined) throw new Error(`Missing env: ${name}`)
  return v || fallback
}

async function findOne(pattern) {
  const list = await fg(pattern, { dot: false })
  return list[0] || null
}

async function main() {
  const OWNER = env('GH_OWNER')
  const REPO  = env('GH_REPO')
  const VERSION = readVersion()
  const TAG = env('GIT_TAG', `v${VERSION}`)

  // Find macOS updater artifacts for both archs
  const armTar = await findOne('src-tauri/target/aarch64-apple-darwin/release/bundle/macos/*.app.tar.gz')
  const armSig = await findOne('src-tauri/target/aarch64-apple-darwin/release/bundle/macos/*.app.tar.gz.sig')

  const x64Tar = await findOne('src-tauri/target/x86_64-apple-darwin/release/bundle/macos/*.app.tar.gz')
  const x64Sig = await findOne('src-tauri/target/x86_64-apple-darwin/release/bundle/macos/*.app.tar.gz.sig')

  if (!armTar || !armSig) {
    console.warn('[warn] Missing aarch64 updater artifacts. Did you build with "--bundles dmg app" for aarch64?')
  }
  if (!x64Tar || !x64Sig) {
    console.warn('[warn] Missing x86_64 updater artifacts. Did you build with "--bundles dmg app" for x86_64?')
  }
  if (!armTar && !x64Tar) {
    throw new Error('No updater artifacts found. Build with app bundle to produce .app.tar.gz + .sig.')
  }

  // Construct platforms section using the actual filenames you will upload
  const platforms = {}

  if (armTar && armSig) {
    const tarName = basename(armTar)
    const url = `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/${tarName}`
    const signature = readFileSync(armSig, 'utf8').trim()
    platforms['darwin-aarch64'] = { url, signature }
  }

  if (x64Tar && x64Sig) {
    const tarName = basename(x64Tar)
    const url = `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/${tarName}`
    const signature = readFileSync(x64Sig, 'utf8').trim()
    platforms['darwin-x86_64'] = { url, signature }
  }

  const latest = {
    version: VERSION,
    notes: "",
    pub_date: new Date().toISOString(),
    platforms
  }

  if (!existsSync('dist')) mkdirSync('dist', { recursive: true })
  writeFileSync('dist/latest.json', JSON.stringify(latest, null, 2))
  console.log('✅ Wrote dist/latest.json with platforms:', Object.keys(platforms))
}

main().catch(err => {
  console.error('make-latest-json failed:', err)
  process.exit(1)
})
