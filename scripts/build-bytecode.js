#!/usr/bin/env node
/**
 * build-bytecode.js  (Task 5.1)
 * Biên dịch toàn bộ backend JS → V8 Bytecode (.jsc) bằng bytenode.
 *
 * Cách dùng: node scripts/build-bytecode.js
 * Output:    dist/server/**\/*.jsc
 */

const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src/server');
const OUT_DIR = path.join(__dirname, '../dist/server');

// Tệp cần giữ lại dưới dạng plain text (entry point)
const PLAIN_FILES = ['index.js'];

let compiled = 0;
let failed = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const srcPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(srcPath);
    } else if (entry.name.endsWith('.js')) {
      const rel = path.relative(SRC_DIR, srcPath);
      const outDir = path.join(OUT_DIR, path.dirname(rel));
      const outJsc = path.join(outDir, entry.name.replace('.js', '.jsc'));
      const outJs = path.join(outDir, entry.name);

      fs.mkdirSync(outDir, { recursive: true });

      if (PLAIN_FILES.includes(entry.name)) {
        // Entry point: copy as-is, adjusting require paths to .jsc
        let src = fs.readFileSync(srcPath, 'utf8');
        fs.writeFileSync(outJs, src);
        console.log(`[copy ]  ${rel}`);
      } else {
        try {
          bytenode.compileFile({ filename: srcPath, output: outJsc });
          compiled++;
          console.log(`[jsc  ]  ${rel} → ${path.relative(OUT_DIR, outJsc)}`);
        } catch (err) {
          failed++;
          console.error(`[ERROR]  ${rel}: ${err.message}`);
        }
      }
    } else if (entry.name.endsWith('.sql')) {
      const rel = path.relative(SRC_DIR, srcPath);
      const outPath = path.join(OUT_DIR, rel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.copyFileSync(srcPath, outPath);
      console.log(`[asset]  ${rel}`);
    }
  }
}

console.log('=== Bytenode Compilation ===');
console.log(`Source: ${SRC_DIR}`);
console.log(`Output: ${OUT_DIR}\n`);

if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

walk(SRC_DIR);

// Tạo loader index.jsc để Electron biết dùng .jsc
const loaderContent = `
'use strict';
require('bytenode');
const { startServer } = require('./server.jsc');
console.log('=== KHOI DONG HE THONG AUTOCHATBOT FB CRM BACKEND (BYTECODE) ===');
startServer();
`.trimStart();
fs.writeFileSync(path.join(OUT_DIR, 'index.js'), loaderContent);

console.log(`\n=== Hoàn tất ===`);
console.log(`Đã biên dịch: ${compiled} file(s)`);
if (failed > 0) console.warn(`Thất bại:     ${failed} file(s)`);
