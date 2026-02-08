import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

// OPTIMIZATION: Lazy load non-critical pages for faster initial load
// These pages will only be downloaded when the user navigates to them
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const SupplierInvoicesPage = lazy(() => import('./pages/SupplierInvoicesPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const InvoiceCreatePage = lazy(() => import('./pages/InvoiceCreatePage'));
const QuotesPage = lazy(() => import('./pages/QuotesPage'));
const DeliveryNotesPage = lazy(() => import('./pages/DeliveryNotesPage'));
const DevisCreatePage = lazy(() => import('./pages/DevisCreatePage'));
const DeliveryNoteCreatePage = lazy(() => import('./pages/DeliveryNoteCreatePage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const CompanySetupPage = lazy(() => import('./pages/CompanySetupPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const ProductServicesPage = lazy(() => import('./pages/ProductServicesPage'));

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Suspense fallback={<PageLoader />}><SignUpPage /></Suspense>} />
        <Route path="/company-setup" element={<Suspense fallback={<PageLoader />}><CompanySetupPage /></Suspense>} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
            <Route path="suppliers" element={<Suspense fallback={<PageLoader />}><SuppliersPage /></Suspense>} />
            <Route path="supplier-invoices" element={<Suspense fallback={<PageLoader />}><SupplierInvoicesPage /></Suspense>} />
            <Route path="invoices" element={<Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>} />
            <Route path="invoices/create" element={<Suspense fallback={<PageLoader />}><InvoiceCreatePage /></Suspense>} />
            <Route path="invoices/edit/:id" element={<Suspense fallback={<PageLoader />}><InvoiceCreatePage /></Suspense>} />
            <Route path="quotes" element={<Suspense fallback={<PageLoader />}><QuotesPage /></Suspense>} />
            <Route path="quotes/create" element={<Suspense fallback={<PageLoader />}><DevisCreatePage /></Suspense>} />
            <Route path="delivery-notes" element={<Suspense fallback={<PageLoader />}><DeliveryNotesPage /></Suspense>} />
            <Route path="delivery-notes/create" element={<Suspense fallback={<PageLoader />}><DeliveryNoteCreatePage /></Suspense>} />
            <Route path="expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<PageLoader />}><ProductServicesPage /></Suspense>} />
            <Route path="users" element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
