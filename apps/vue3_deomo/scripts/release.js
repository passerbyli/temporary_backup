/**
 * release.js
 * 1. 执行 build
 * 2. 压缩 dist -> zip
 * 3. 清空 dist 目录
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const rimraf = require('rimraf')

const DIST_DIR = path.resolve(__dirname, '../dist')
const RELEASE_DIR = path.resolve(__dirname, '../release')
const time = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)

const ZIP_NAME = `dist_${time}.zip`

function runBuild() {
  console.log('🚀 Running build...')
  execSync('pnpm run build', { stdio: 'inherit' })
}

function zipDist() {
  console.log('📦 Zipping dist...')
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist directory does not exist')
  }

  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR)
  }

  const output = fs.createWriteStream(path.join(RELEASE_DIR, ZIP_NAME))
  const archive = archiver('zip', { zlib: { level: 9 } })

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`✅ Zip created: release/${ZIP_NAME}`)
      resolve()
    })

    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(DIST_DIR, false)
    archive.finalize()
  })
}

function clearDist() {
  console.log('🧹 Cleaning dist...')
  rimraf.sync(`${DIST_DIR}/*`)
}

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
