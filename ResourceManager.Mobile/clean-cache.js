#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧹 Cleaning Expo cache...');

try {
  // Remove .expo directory
  if (fs.existsSync('.expo')) {
    fs.rmSync('.expo', { recursive: true, force: true });
    console.log('✅ Removed .expo directory');
  }

  // Clear node_modules
  if (fs.existsSync('node_modules')) {
    fs.rmSync('node_modules', { recursive: true, force: true });
    console.log('✅ Removed node_modules');
  }

  // Remove package-lock.json
  if (fs.existsSync('package-lock.json')) {
    fs.unlinkSync('package-lock.json');
    console.log('✅ Removed package-lock.json');
  }

  console.log('🔄 Please run npm install after this');
  console.log('📱 Then run: npx expo start --clear');
} catch (error) {
  console.error('❌ Error:', error.message);
}