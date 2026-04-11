// ═══════════════════════════════════════════════════════════════════════
// BACKEND INTEGRATION TOGGLE
// ═══════════════════════════════════════════════════════════════════════
// 
// Toggle this to switch between dummy data and real API calls:
// 
// true  = Use dummy/mock data (no backend required) - CURRENT MODE
// false = Connect to real backend API (requires backend server)
//
// When switching to false, also configure VITE_API_URL in your .env file
// See BACKEND_INTEGRATION.md for detailed instructions
// ═══════════════════════════════════════════════════════════════════════

export const USE_DUMMY_DATA = true;

// This flag will be checked by all API calls
// When true: return dummy data
// When false: make real backend calls