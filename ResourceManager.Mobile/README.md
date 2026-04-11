# ResourceManager Mobile App

A React Native mobile application for ResourceManager with focus on reading invoices and sending emails, using the exact Figma design system.

## 📐 Design System

Based on Figma design with purple-centric color palette:

### Colors
- **Primary Purple**: `#7C3AED`
- **Primary Light**: `#EDE9FE`
- **Success Green**: `#10B981`
- **Warning Yellow**: `#F59E0B`
- **Error Red**: `#EF4444`
- **Background**: `#F9FAFB`
- **Text Primary**: `#111827`
- **Text Secondary**: `#374151`

### Typography
- **Font Family**: Inter
- **H1**: 24px (Page Titles)
- **H2**: 20px (Section Titles)
- **Body**: 14px (Normal Text)
- **Small**: 12px (Status Badges)

### Components
- Card (White with shadow)
- Button (Primary/Secondary/Danger variants)
- Input (With label and error states)
- StatusBadge (Pill-shaped status indicators)
- Modal (Overlay modals)
- Loading (Inline and overlay)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (for development)
- Android Studio / Xcode (for building)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Start on Android
npm run android

# Start on iOS
npm run ios
```

## 📁 Project Structure

```
ResourceManager.Mobile/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Modal.tsx
│   │   ├── Loading.tsx
│   │   └── EmptyState.tsx
│   ├── screens/            # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── InvoicesListScreen.tsx
│   │   ├── InvoiceDetailScreen.tsx
│   │   ├── ScanInvoiceScreen.tsx
│   │   ├── ConfirmSupplierInvoiceScreen.tsx
│   │   ├── EmailComposerScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── navigation/         # Navigation configuration
│   │   ├── AppNavigator.tsx
│   │   └── index.ts
│   ├── api/              # API service layer
│   │   ├── config.ts
│   │   ├── auth.ts
│   │   ├── invoices.ts
│   │   ├── supplierInvoices.ts
│   │   └── index.ts
│   ├── hooks/            # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useInvoice.ts
│   │   ├── useOffline.ts
│   │   └── index.ts
│   ├── theme/            # Design system
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── borderRadius.ts
│   │   ├── shadows.ts
│   │   └── index.ts
│   └── utils/            # Utility functions
│       ├── errorUtils.ts
│       ├── formatUtils.ts
│       └── index.ts
├── assets/              # Static assets
│   ├── images/
│   └── fonts/
├── app.json             # Expo configuration
├── App.tsx             # Main app component
├── entry-point.tsx      # Entry point
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── babel.config.js      # Babel configuration
└── README.md           # This file
```

## 🔑 Authentication

The app uses JWT-based authentication with the following API endpoints:

- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- Tokens are stored in AsyncStorage

## 📄 Features

### Invoice Management (Read-Only)
- List invoices with pagination
- View invoice details
- Download PDF invoices
- View line items and payments
- Status badges (Paid/Pending/Overdue)

### Email Sending
- Compose emails with templates
- Attach invoice PDFs
- Auto-fill client information
- Send via existing backend API

### Invoice Scanning (Camera)
- Native camera integration
- Image capture and compression
- Upload to existing backend API
- Review and confirm extracted data
- Offline queue for pending scans

### Offline Support
- Queue failed API requests
- Queue pending invoice scans
- Auto-retry when connection restored
- Local storage for offline data

## 🔌 API Integration

All API calls go through the existing ResourceManager backend:

**Authentication API:**
- Login, logout, token refresh

**Invoices API:**
- List invoices (GET)
- Get invoice details (GET)
- Send email (POST)

**Supplier Invoices API:**
- Upload scan (POST)
- Confirm invoice (POST)
- Get file (GET)

## 📱 Screens

1. **Login Screen**
   - Email/password form
   - Remember me option
   - Forgot password link

2. **Invoices List Screen**
   - Paginated invoice list
   - Pull-to-refresh
   - Search functionality
   - Status filter

3. **Invoice Detail Screen**
   - Invoice information
   - Client details
   - Amount breakdown
   - Line items list
   - Send email button
   - Download PDF button

4. **Scan Invoice Screen**
   - Camera viewfinder
   - Image preview
   - Capture/retake options
   - Upload to API

5. **Confirm Supplier Invoice Screen**
   - Review extracted data
   - Edit fields
   - Confirm/save action

6. **Email Composer Screen**
   - Recipient field
   - Subject and body
   - Attachment toggle
   - Template support

7. **Settings Screen**
   - Account information
   - Notification settings
   - About information
   - Logout action

## 🎨 Navigation

- **Bottom Tab Navigation** (3 tabs)
  - Invoices
  - Scan
  - Settings

- **Stack Navigation**
  - Auth Stack (Login only)
  - Main Tabs (authenticated users)

## 🔧 Configuration

### API Base URL

Update the API base URL in `src/api/config.ts`:

```typescript
const getApiBaseUrl = () => {
  if (__DEV__) {
    return 'http://localhost:5000/api'; // Development
  }
  return process.env.EXPO_PUBLIC_API_URL || 'https://your-api-domain.com/api'; // Production
};
```

### Environment Variables

Create a `.env` file in the root:

```
EXPO_PUBLIC_API_URL=https://your-api-domain.com/api
```

## 📦 Dependencies

### Core
- react 18.2.0
- react-native 0.73.6
- expo ~50.0.0

### Navigation
- @react-navigation/native ^6.1.9
- @react-navigation/native-stack ^6.9.17
- @react-navigation/bottom-tabs ^6.5.11
- react-native-safe-area-context 4.9.0
- react-native-screens ~3.29.0

### State Management
- @tanstack/react-query ^5.17.9

### Camera & Media
- expo-camera ~14.0.0
- expo-image-picker ~14.7.0
- expo-file-system ~16.0.0
- expo-media-library ~15.9.1

### Utilities
- expo-local-authentication ~13.8.0
- expo-secure-store ~12.8.0
- @expo/vector-icons ^14.0.0

### Other
- axios ^1.6.7
- react-native-fast-image ^8.6.3
- react-native-gesture-handler ~2.14.0
- react-native-reanimated ~3.6.0

## 🛠️ Building

### Development Build
```bash
npm run android
# or
npm run ios
```

### Production Build
Use EAS Build or run locally:

```bash
eas build --platform android
# or
eas build --platform ios
```

## 📝 Notes

- **No AI Used**: The app uses the phone's native camera for scanning without AI processing
- **Same API**: Reuses existing backend API endpoints
- **Read-Only**: Mobile app focuses on reading and sending, not creating/editing
- **Design System**: Exact colors and components from Figma design

## 🐛 Troubleshooting

### Camera Permission Issues
```typescript
// Check camera permissions
const { status } = await Camera.getCameraPermissionsAsync();
if (status !== 'granted') {
  await Camera.requestCameraPermissionsAsync();
}
```

### API Connection Issues
- Check API base URL in `src/api/config.ts`
- Verify backend is running
- Check network connectivity
- Review AsyncStorage for stale tokens

## 📄 License

This mobile application is part of the ResourceManager project.
