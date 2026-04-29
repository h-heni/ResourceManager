// API Configuration
//
// Set EXPO_PUBLIC_API_URL in .env to point at your backend.
// Examples:
//   Local backend on host machine:        http://10.0.2.2:5249/api      (Android emulator)
//   Local backend on physical device:     http://<your-LAN-IP>:5249/api
//   Local backend on iOS simulator:       http://localhost:5249/api
//   Production:                           https://rscmanager.com/api
//
// In production builds we *require* HTTPS. Plain HTTP is only allowed in __DEV__.
const getApiBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.length > 0) {
    if (!__DEV__ && !fromEnv.startsWith('https://')) {
      // Fail loud rather than silently shipping a release build that talks plaintext.
      throw new Error('Production API URL must use HTTPS. Got: ' + fromEnv);
    }
    return fromEnv;
  }
  if (__DEV__) {
    // No hardcoded LAN IP — require the developer to set EXPO_PUBLIC_API_URL.
    // (Falling back here historically leaked an internal IP in committed code.)
    if (typeof console !== 'undefined') {
      console.warn('[CONFIG] EXPO_PUBLIC_API_URL is not set. Using http://localhost:5249/api as last resort.');
    }
    return 'http://localhost:5249/api';
  }
  return 'https://rscmanager.com/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Default timeout for API requests
export const API_TIMEOUT = 30000; // 30 seconds

// Default page size for paginated requests
export const DEFAULT_PAGE_SIZE = 20;
