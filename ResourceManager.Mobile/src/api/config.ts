// API Configuration
const getApiBaseUrl = () => {
  // Check for explicit override first (set EXPO_PUBLIC_API_URL in .env for different environments)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Physical Android/iOS device: use machine's LAN IP
  // Android emulator: use 10.0.2.2 (maps to host machine)
  if (__DEV__) {
    return 'http://192.168.178.26:5249/api';
  }
  return 'https://your-api-domain.com/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Default timeout for API requests
export const API_TIMEOUT = 30000; // 30 seconds

// Default page size for paginated requests
export const DEFAULT_PAGE_SIZE = 20;
