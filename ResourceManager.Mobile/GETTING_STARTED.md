# Getting Started - ResourceManager Mobile

## 🚀 Quick Start

### Option 1: Automated Clean and Start (Recommended)

Double-click `clean-start.bat` or run:

```bash
cd "C:\Users\hp\OneDrive\Desktop\ResourceManager\ResourceManager.Mobile"
clean-start.bat
```

### Option 2: Manual Setup

**Step 1: Clean cache**
```bash
rmdir /s /q .expo
```

**Step 2: Install dependencies**
```bash
npm install
```

**Step 3: Start development server**
```bash
npm start
```

## 📱 Running the App

Once Expo starts:

1. **Open in Browser**
   - Go to [http://localhost:8081](http://localhost:8081)
   - Shows QR code and controls

2. **Run on Android**
   - Press 'a' in terminal
   - Or scan QR code with Expo Go app

3. **Run on iOS**
   - Press 'i' in terminal
   - Requires Xcode and iOS simulator

4. **Run on Web**
   - Press 'w' in terminal
   - Opens in web browser

## ⚙️ Configuration

### API URL

Edit `.env` file:

```bash
EXPO_PUBLIC_API_URL=http://localhost:5000/api

# For production:
# EXPO_PUBLIC_API_URL=https://your-api.com/api
```

### Environment Variables

- `EXPO_PUBLIC_API_URL` - Backend API base URL

## 🔧 Requirements

### Minimum Requirements
- **Node.js**: v18.17+ (v18 recommended for stability)
- **npm**: v9+ (or yarn v1.22+)
- **Expo Go App**: For Android testing
- **Xcode**: For iOS development (macOS only)
- **Android Studio**: For Android development

### Checking Your Environment

```bash
# Check Node version
node --version

# Check npm version
npm --version

# Check Expo CLI
expo --version
```

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start development server |
| `npm run android` | Start and open on Android |
| `npm run ios` | Start and open on iOS |
| `npm run web` | Start and open in web browser |
| `npm run clean` | Clean cache and node_modules |
| `npm run install:clean` | Clean npm cache and reinstall |

## 🐛 Troubleshooting

### Issue: "ENOENT: no such file or directory, mkdir 'node:sea'"

**Cause**: Node.js v20+ SEA bundling issue on Windows

**Solution**:
```bash
# Use Node.js v18 instead
nvm install 18
nvm use 18

# Or download from: https://nodejs.org/
```

### Issue: npm install fails with "No matching version found"

**Solution**:
```bash
# Clean everything and reinstall
npm run clean
npm run install:clean
```

### Issue: Module not found errors

**Solution**:
```bash
# Clear Metro cache and restart
rmdir /s /q .expo
npm start
```

### Issue: Camera permissions not working

**Solution**:
1. Stop the app
2. Reinstall Expo Go app on device
3. Grant camera permissions when prompted
4. Restart app

## 📋 Dependencies

All dependencies are pinned to specific secure versions.

See `package.json` for complete list.

## 🔒 Security

- All dependencies are fixed versions (no vulnerable ranges)
- JWT-based authentication
- Secure storage for tokens (AsyncStorage)
- HTTPS communication with backend

## 📱 App Structure

```
src/
├── components/    # Reusable UI components
├── screens/       # Screen components
├── navigation/    # Navigation configuration
├── api/          # API service layer
├── hooks/         # Custom React hooks
├── theme/         # Design system
└── utils/         # Utility functions
```

## 🎨 Design System

The app uses the exact Figma design system:

- **Primary Color**: `#7C3AED` (Purple)
- **Font**: Inter (Regular/Medium/SemiBold/Bold)
- **Components**: Cards, Buttons, Status Badges, Modals
- **Border Radius**: 4px-50% depending on component

## 📞 Support

For issues or questions:
1. Check `STARTUP_TROUBLESHOOTING.md`
2. Review this `GETTING_STARTED.md`
3. Check [Expo Documentation](https://docs.expo.dev)

## ✅ Success Indicators

When everything works, you'll see:

```
› Ready
› Metro waiting on exp://...
› Scanning for folders...

› Scan the QR code above with Expo Go (Android) or Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web
› Press r │ reload
› Press d │ show dev tools
› Shift+d │ toggle debug mode
```
