// scripts/make-latest-json.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import fg from 'fast-glob';

function getVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  const cfg = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  if (!cfg.version) throw new Error('No version in src-tauri/tauri.conf.json and APP_VERSION not set');
  return cfg.version;
}

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function findOne(glob) {
  const list = await fg(glob);
  return list[0] || null;
}

(async () => {
  const OWNER   = 'runtime-org';
  const REPO    = 'runtime';
  const VERSION = getVersion();
  const TAG     = process.env.GIT_TAG || `v${VERSION}`;

  // Universal artifacts
  const base = 'src-tauri/target/universal-apple-darwin/release/bundle/macos';
  const tar  = await findOne(`${base}/*.app.tar.gz`);
  const sig  = await findOne(`${base}/*.app.tar.gz.sig`);
  if (!tar || !sig) {
    throw new Error('Universal updater artifacts not found. Did you build with "--target universal-apple-darwin --bundles dmg app"?');
  }

  const url        = `https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/${basename(tar)}`;
  const signature  = readFileSync(sig, 'utf8').trim();

  const latest = {
    version: VERSION,
    notes: "",
    pub_date: new Date().toISOString(),
    platforms: {
      // Point both architectures to the same universal tarball
      "darwin-aarch64": { url, signature },
      "darwin-x86_64":  { url, signature }
    }
  };

  if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
  writeFileSync('dist/latest.json', JSON.stringify(latest, null, 2));
  console.log('dist/latest.json written for universal macOS');
})();
