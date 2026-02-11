import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import SettingsGuard from './components/SettingsGuard';
import { AuthProvider } from './context/AuthContext';

// OPTIMIZATION: Lazy load all authenticated pages for faster initial load
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
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
const CompanyInitPage = lazy(() => import('./pages/CompanyInitPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const ProductServicesPage = lazy(() => import('./pages/ProductServicesPage'));
const DataManagementPage = lazy(() => import('./pages/DataManagementPage'));
const SupplierInvoiceUploadPage = lazy(() => import('./pages/SupplierInvoiceUploadPage'));

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#065F46]"></div>
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
          <Route path="/company-init" element={<Suspense fallback={<PageLoader />}><CompanyInitPage /></Suspense>} />
          <Route path="/" element={<Suspense fallback={<PageLoader />}><DashboardLayout /></Suspense>}>
            <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />

            <Route element={<SettingsGuard />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
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
              <Route path="data-management" element={<Suspense fallback={<PageLoader />}><DataManagementPage /></Suspense>} />
              <Route path="upload-supplier" element={<Suspense fallback={<PageLoader />}><SupplierInvoiceUploadPage /></Suspense>} />
              <Route path="users" element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
