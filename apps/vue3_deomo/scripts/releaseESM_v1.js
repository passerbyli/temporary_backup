/**
 * release.js (ESM)
 * build -> zip dist (zip inside dist) -> clear dist except zip
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import archiver from 'archiver'
import { fileURLToPath } from 'node:url'

import pkg from '../package.json' assert { type: 'json' }


// ===== ESM dirname =====
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== paths =====
const DIST_DIR = path.resolve(__dirname, '../dist')

const time = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)

let ZIP_NAME = `dist_${time}.zip`
 ZIP_NAME = `${pkg.name}_v${pkg.version}_${time}.zip`
const ZIP_PATH = path.join(DIST_DIR, ZIP_NAME)

// ===== build =====
function runBuild() {
  console.log('🚀 Running build...')
  execSync('pnpm run build', { stdio: 'inherit' })
}

// ===== zip =====
function zipDist() {
  console.log('📦 Zipping dist...')

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist directory does not exist')
  }

  const output = fs.createWriteStream(ZIP_PATH)
  const archive = archiver('zip', { zlib: { level: 9 } })

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`✅ Zip created: ${ZIP_PATH}`)
      resolve()
    })

    archive.on('error', reject)

    archive.pipe(output)

    // ⚠️ 排除 zip 本身，避免把自己打进去
    archive.glob('**/*', {
      cwd: DIST_DIR,
      ignore: [ZIP_NAME],
    })

    archive.finalize()
  })
}

// ===== clear dist except zip =====
function clearDistExceptZip() {
  console.log('🧹 Cleaning dist except zip...')

  const files = fs.readdirSync(DIST_DIR)

  for (const file of files) {
    if (file === ZIP_NAME) continue

    const fullPath = path.join(DIST_DIR, file)
    fs.rmSync(fullPath, { recursive: true, force: true })
  }
}

// ===== main =====
;(async function main() {
  try {
    runBuild()
    await zipDist()
    clearDistExceptZip()
    console.log('🎉 Release finished')
  } catch (err) {
    console.error('❌ Release failed:', err)
    process.exit(1)
  }
})()
