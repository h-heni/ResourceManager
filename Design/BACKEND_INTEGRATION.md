# Backend Integration Guide

This Resource Manager application is built with a flexible architecture that allows you to easily switch between dummy data and real backend API calls.

## Current Mode: Dummy Data

The application is currently running with **dummy data** for demonstration purposes. All data you see is mock data and does not persist.

## How to Enable Backend Integration

To switch from dummy data to real backend API calls, follow these steps:

### 1. Update the Configuration Flag

Edit `/src/app/config/useDummyData.ts`:

```typescript
// Change this from true to false
export const USE_DUMMY_DATA = false;
```

### 2. Set Your Backend API URL

Create a `.env` file in the root directory:

```env
VITE_API_URL=https://your-backend-api.com
```

Or if your backend is running locally:

```env
VITE_API_URL=http://localhost:7175
```

### 3. Backend Requirements

Your backend API should support the following endpoints:

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

#### Invoices
- `GET /api/invoices?page=1&pageSize=20&search=` - List invoices
- `GET /api/invoices/:id` - Get single invoice
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

#### Clients
- `GET /api/clients?page=1&pageSize=20&search=` - List clients
- `GET /api/clients/:id` - Get single client
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

#### Suppliers
- `GET /api/suppliers?page=1&pageSize=20&search=` - List suppliers
- Similar CRUD operations as clients

#### Dashboard
- `GET /api/dashboard/stats?currency=USD&year=2024` - Get dashboard statistics

## Data Flow Architecture

### With Dummy Data (Current)
```
Component → Custom Hook → Dummy Data Service → Return Mock Data
```

### With Real Backend
```
Component → Custom Hook → API Service → Axios → Backend API → Real Data
```

## Key Files to Review

- `/src/app/config/useDummyData.ts` - Toggle flag
- `/src/app/services/api.ts` - API service with axios configuration
- `/src/app/services/dummyData.ts` - All dummy data definitions
- `/src/app/hooks/*.ts` - Custom hooks that check USE_DUMMY_DATA flag

## Custom Hooks Pattern

All data-fetching hooks follow this pattern:

```typescript
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      if (USE_DUMMY_DATA) {
        // Return dummy data
        return dummyInvoices;
      }
      
      // Make real API call
      const response = await api.get('/invoices');
      return response.data;
    },
  });
}
```

This ensures a seamless transition between dummy data and real backend without changing component code.

## Authentication Flow

### Dummy Data Mode
- Auto-login as Manager user
- No actual authentication required
- All API calls return mock data immediately

### Backend Mode
- Full authentication with JWT tokens
- Token stored in-memory (not localStorage for security)
- Automatic token refresh via HttpOnly cookies
- Cross-tab session synchronization via BroadcastChannel

## Testing Backend Integration

1. Set `USE_DUMMY_DATA = false`
2. Ensure backend is running and accessible
3. Check browser console for any API errors
4. Verify authentication flow works
5. Test CRUD operations on entities

## Migration Checklist

- [ ] Set `USE_DUMMY_DATA = false`
- [ ] Configure `VITE_API_URL` environment variable
- [ ] Verify backend endpoints match expected structure
- [ ] Test authentication flow
- [ ] Test all data fetching operations
- [ ] Verify error handling works correctly
- [ ] Test pagination and search functionality

## Troubleshooting

**Problem**: API calls failing with CORS errors
- **Solution**: Ensure backend has proper CORS headers configured

**Problem**: Authentication not working
- **Solution**: Check that backend returns correct token format and sets HttpOnly cookie

**Problem**: Data not loading
- **Solution**: Open browser DevTools Network tab and check API responses

## Support

For backend integration issues, ensure your backend follows the expected API contract defined in the dummy data services.
