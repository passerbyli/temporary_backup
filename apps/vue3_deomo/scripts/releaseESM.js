/**
 * release.js (ESM)
 * build -> zip dist -> clear dist
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import archiver from 'archiver'
import { fileURLToPath } from 'node:url'

// ===== ESM __dirname =====
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== paths =====
const DIST_DIR = path.resolve(__dirname, '../dist')
const RELEASE_DIR = path.resolve(__dirname, '../release')

const time = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)

const ZIP_NAME = `dist_${time}.zip`

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

  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR)
  }

  const zipPath = path.join(RELEASE_DIR, ZIP_NAME)
  const output = fs.createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`✅ Zip created: ${zipPath}`)
      resolve()
    })

    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(DIST_DIR, false)
    archive.finalize()
  })
}

// ===== clear dist =====
function clearDist() {
  console.log('🧹 Cleaning dist...')
  // Node >=14.14
  fs.rmSync(DIST_DIR, { recursive: true, force: true })
  fs.mkdirSync(DIST_DIR)
}

// ===== main =====
;(async function main() {
  try {
    runBuild()
    await zipDist()
    clearDist()
    console.log('🎉 Release finished')
  } catch (err) {
    console.error('❌ Release failed:', err)
    process.exit(1)
  }
})()
