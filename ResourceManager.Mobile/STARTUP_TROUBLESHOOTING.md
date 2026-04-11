# Startup Troubleshooting - ResourceManager Mobile

## 🚨 Issue: Node.js SEA Bundling Error

Error: `ENOENT: no such file or directory, mkdir '...node:sea'`

This is a known issue with Expo CLI on Windows when using Node.js v20+.

## 🔧 Solutions

### Solution 1: Clean and Start (Recommended)

Run the batch script:
```bash
clean-start.bat
```

Or manually:
```bash
# Remove .expo cache
rmdir /s /q .expo

# Start fresh
npm start
```

### Solution 2: Downgrade Node.js

If using Node.js v20+, try v18:

```bash
# Using nvm (Node Version Manager)
nvm install 18
nvm use 18

# Using n (Node version manager)
n 18

# Then try again
npm start
```

### Solution 3: Deep Clean

If above doesn't work, do a full clean:

```bash
# Remove all generated files
rmdir /s /q .expo
rmdir /s /q node_modules
del package-lock.json

# Reinstall dependencies
npm install

# Start again
npm start
```

Run with:
```bash
clean-start.bat --deep
```

### Solution 4: Update Expo CLI

The issue might be fixed in newer Expo CLI:

```bash
npm install -g @expo/cli
```

Or update locally:
```bash
npm install expo@latest --save-exact
```

## 📋 Requirements

- **Node.js**: v18.17+ (v20 may have issues on Windows)
- **npm**: v9+ (or yarn 1.22+)
- **Expo SDK**: v50

## ✅ After Fix

Once the app starts successfully:
- Open [http://localhost:8081](http://localhost:8081) in browser
- Press 'a' for Android
- Press 'i' for iOS
- Press 'w' for web

## 🔍 Verification

Check node version:
```bash
node --version
```

Check npm version:
```bash
npm --version
```

Check Expo CLI:
```bash
expo --version
```

## 📞 If Issues Persist

Try alternative development server:

```bash
npx expo start --clear --no-dev --minify
```

Or use web-only mode:
```bash
npm run web
```
