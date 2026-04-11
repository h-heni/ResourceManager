# Resource Manager - Figma Make

This is a comprehensive business management application built with React, TypeScript, and Tailwind CSS. It features invoice management, client/supplier tracking, inventory management, and financial reporting.

## 🎯 Current Status

The application is running in **DEMO MODE** with dummy data. This allows you to explore all features without needing a backend.

### Features Implemented

- ✅ **Dashboard** - Financial overview with charts and statistics
- ✅ **Invoices** - Create, view, edit, and manage invoices
- ✅ **Clients** - Client management with contact information
- ✅ **Suppliers** - Supplier database with purchase tracking
- ✅ **Multi-language Support** - English, French, German, Arabic (RTL)
- ✅ **Authentication** - Secure login with role-based access (Manager/Employee)
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

### Additional Pages (Placeholders)
- Quotes
- Delivery Notes
- Expenses
- Products & Services
- Inventory Management
- User Management
- Settings

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm package manager

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm dev
```

3. Open your browser and navigate to the local development URL displayed in the terminal.

## 🔄 Switching to Real Backend

This application is designed to easily switch between dummy data and real backend API calls.

**To enable backend integration:**

1. Edit `/src/app/config/useDummyData.ts`
2. Change `USE_DUMMY_DATA` from `true` to `false`
3. Set your backend API URL in `.env` file

For detailed instructions, see [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md)

## 📁 Project Structure

```
/src
  /app
    /components      # Reusable React components
    /pages          # Page components
    /layouts        # Layout wrappers (Dashboard)
    /hooks          # Custom React hooks for data fetching
    /services       # API service and dummy data
    /context        # React Context (Auth)
    /lib            # Utility functions
    /i18n           # Internationalization
    /config         # Configuration files
  /styles           # Global styles and Tailwind
```

## 🛠 Technologies Used

- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS v4** - Utility-first CSS framework
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Recharts** - Chart library for data visualization
- **i18next** - Internationalization framework
- **Axios** - HTTP client
- **React Hot Toast** - Toast notifications

## 🎨 Design Features

- Clean, modern UI with consistent color scheme
- Responsive navigation with mobile drawer
- Interactive charts and data visualizations
- Role-based access control
- Multi-currency support
- Date localization

## 🔐 Demo Credentials

In demo mode, click "Sign In" to auto-login as:
- **Role:** Manager
- **Name:** John Doe
- **Email:** admin@example.com

## 📊 Dummy Data

The application includes realistic dummy data for:
- 5 Invoices (various statuses)
- 5 Clients
- 3 Suppliers
- 4 Products/Services
- 3 Expenses
- Dashboard statistics and charts

## 🌍 Language Support

Switch between languages using the globe icon in the header:
- 🇺🇸 English
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇸🇦 العربية (with RTL support)

## 📝 Building for Production

To create a production build:

```bash
pnpm build
```

The optimized files will be generated in the `/dist` directory.

## 🤝 Contributing

This project structure is designed to be easily extended:
- All backend calls are centralized in `/src/app/hooks`
- Dummy data can be found in `/src/app/services/dummyData.ts`
- Add new pages in `/src/app/pages`
- Update routing in `/src/app/routes.tsx`

## 📄 License

This project is open source and available under the MIT License.

---

**Note:** This is a demonstration application. In production, ensure you implement proper security measures, including secure authentication, input validation, and data encryption.