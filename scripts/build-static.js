'use strict'

// Copies web-src/ verbatim to dist/application/web-prod/, bypassing Parcel.
// This preserves extensionless files (e.g. .well-known/openai-apps-challenge)
// so they are served correctly from adobeio-static.net without CDN rewrites.

const fs = require('fs')
const path = require('path')

function copyDir (src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const src = path.join(__dirname, '..', 'web-src')
const dest = path.join(__dirname, '..', 'dist', 'application', 'web-prod')
copyDir(src, dest)
