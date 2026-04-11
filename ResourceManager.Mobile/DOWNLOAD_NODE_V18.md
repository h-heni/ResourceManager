# 📦 Install Node.js v18 Directly (No nvm required)

## 🎯 Solution Options

### Option 1: Download and Install Node.js v18 Manually

**Step 1: Download Node.js v18**
1. Open browser and go to: **https://nodejs.org/en/download**
2. Select **18.17.1 LTS** version (or any 18.x version)
3. Download **Windows Installer (.msi)** 64-bit

**Step 2: Install**
1. Double-click the downloaded `.msi` file
2. Follow the installation wizard
3. **IMPORTANT:** Check "Add to PATH" during installation
4. Click Install and wait for completion

**Step 3: Verify Installation**
Open new terminal and run:
```bash
node --version
```

Expected output: `v18.x.x.x`

**Step 4: Restart Terminal**
Close current terminal and open a new one to pick up the new Node.js version.

**Step 5: Start App**
```bash
cd "C:\Users\hp\OneDrive\Desktop\ResourceManager\ResourceManager.Mobile"
npm start
```

---

### Option 2: Use Chocolatey Package Manager

If you have **Chocolatey** installed (Windows package manager):

```bash
# Install Node.js v18
choco install nodejs-lts

# This installs the latest LTS version

# Or install specific version
choco install nodejs --version=18.17.1
```

**Step 1: Check if Chocolatey is installed**
```bash
choco --version
```

If not installed, install Chocolatey first:
```bash
# Run PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
```

**Step 2: Install Node.js v18**
```bash
choco install nodejs-lts
```

**Step 3: Restart terminal and verify**
```bash
node --version
```

**Step 4: Start app**
```bash
cd "C:\Users\hp\OneDrive\Desktop\ResourceManager\ResourceManager.Mobile"
npm start
```

---

### Option 3: Use Scoop Package Manager

If you have **Scoop** installed (another Windows package manager):

```bash
# Install Node.js v18
scoop install nodejs-lts@18

# Or install latest LTS
scoop install nodejs-lts
```

**Step 1: Check if Scoop is installed**
```bash
scoop --version
```

If not installed, install Scoop first:
```bash
# Run PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

**Step 2: Install Node.js v18**
```bash
scoop install nodejs-lts@18
```

**Step 3: Restart terminal and verify**
```bash
node --version
```

**Step 4: Start app**
```bash
cd "C:\Users\hp\OneDrive\Desktop\ResourceManager\ResourceManager.Mobile"
npm start
```

---

### Option 4: Use npm to Install Global Node.js

**Warning:** This method is not recommended as it may cause conflicts.

```bash
# Try to install Node.js globally (may not work)
npm install -g node@18.17.1

# Then verify
node --version
```

---

## 📋 Quick Comparison

| Method | Difficulty | Requires Admin | Removes Old Version | Recommended |
|--------|-----------|----------------|-------------------|------------|
| Direct Installer | Easy | No | ✅ Yes | ⭐⭐⭐ |
| Chocolatey | Medium | No | ✅ Yes | ⭐⭐ |
| Scoop | Medium | No | ✅ Yes | ⭐⭐ |
| npm global | Hard | No | ❌ No | ⭐ |

---

## ✅ Recommended Method: **Direct Installer**

**Why:** Easiest, most reliable, no additional tools needed

**Steps:**
1. Go to: https://nodejs.org/en/download
2. Download: Windows Installer 64-bit (.msi)
3. Install with PATH enabled
4. Close all terminal windows
5. Open new terminal
6. Run: `node --version` to verify
7. Run: `npm start` in project folder

---

## 🛠️ If Installation Fails

### Issue: "Access Denied"

**Solution:** Run installer as Administrator
- Right-click `.msi` file
- Select "Run as Administrator"

### Issue: "Node still shows v20"

**Solution: Restart Windows
- Node.js PATH may need system restart
- Restart Windows and try again

### Issue: "Multiple Node.js versions"

**Solution:** Uninstall old version first
1. Go to Settings → Apps → Installed Apps
2. Find Node.js v20
3. Uninstall it
4. Reboot
5. Install Node.js v18

---

## 🎯 After Installing Node.js v18

Once Node.js v18 is installed:

1. **Verify version:**
   ```bash
   node --version
   ```
   Should show: `v18.x.x.x`

2. **Clean project:**
   ```bash
   cd "C:\Users\hp\OneDrive\Desktop\ResourceManager\ResourceManager.Mobile"
   rmdir /s /q .expo
   rmdir /s /q node_modules
   del package-lock.json
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start app:**
   ```bash
   npm start
   ```

---

## 📱 Download Links

| Version | Download Link |
|---------|---------------|
| Node.js 18.17.1 | https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi |
| Node.js 18.20.0 | https://nodejs.org/dist/v18.20.0/node-v18.20.0-x64.msi |
| Latest 18.x | https://nodejs.org/en/download/current (select 18.x) |

---

## 🎉 Success Indicators

When everything works:

- ✅ `node --version` shows `v18.x.x.x`
- ✅ `npm start` runs without "node:sea" error
- ✅ Expo starts and shows "Metro waiting on exp://..."
- ✅ Browser opens at http://localhost:8081
- ✅ App shows purple screen with "Resource Manager Mobile"

---

## 📞 Additional Help

If you need help installing Node.js v18:

- **Node.js Installation Guide:** https://nodejs.org/en/download/package-manager
- **Windows Package Managers:**
  - Chocolatey: https://chocolatey.org/
  - Scoop: https://scoop.sh/
- **Node.js Documentation:** https://nodejs.org/en/docs

---

**Download Node.js v18 from nodejs.org, install it, and then run `npm start`** 🚀
