import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import SuppliersPage from './pages/SuppliersPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceCreatePage from './pages/InvoiceCreatePage';
import ProductsPage from './pages/ProductsPage';
import QuotesPage from './pages/QuotesPage';
import QuoteCreatePage from './pages/QuoteCreatePage';
import ExpensesPage from './pages/ExpensesPage';
import UsersPage from './pages/UsersPage';
import DeliveryNotesPage from './pages/DeliveryNotesPage';
import DeliveryNoteCreatePage from './pages/DeliveryNoteCreatePage';
import SupplierInvoicesPage from './pages/SupplierInvoicesPage';
import SupplierInvoiceUploadPage from './pages/SupplierInvoiceUploadPage';
import InventoryPage from './pages/InventoryPage';
import InventoryReportsPage from './pages/InventoryReportsPage';
import SettingsPage from './pages/SettingsPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import StockAlertsPage from './pages/StockAlertsPage';
import DataManagementPage from './pages/DataManagementPage';
import PanzeDashboard from './pages/PanzeDashboard';
import PanzeFormDemo from './pages/PanzeFormDemo';
import BillFlowLandingPage from './pages/BillFlowLandingPage';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Root layout that provides AuthContext to all routes
// This must be inside the router context so useNavigate works
function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'landing',
        element: <BillFlowLandingPage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'new-dashboard',
            element: <PanzeDashboard />,
          },
          {
            path: 'new-dashboard/forms',
            element: <PanzeFormDemo />,
          },
          {
            element: <DashboardLayout />,
            children: [
              {
                index: true,
                element: <DashboardPage />,
              },
              {
                path: 'dashboard',
                element: <DashboardPage />,
              },
              {
                path: 'clients',
                element: <ClientsPage />,
              },
              {
                path: 'suppliers',
                element: <SuppliersPage />,
              },
              {
                path: 'invoices',
                element: <InvoicesPage />,
              },
              {
                path: 'invoices/create',
                element: <InvoiceCreatePage />,
              },
              {
                path: 'invoices/edit/:id',
                element: <InvoiceCreatePage />,
              },
              {
                path: 'quotes',
                element: <QuotesPage />,
              },
              {
                path: 'quotes/create',
                element: <QuoteCreatePage />,
              },
              {
                path: 'quotes/edit/:id',
                element: <QuoteCreatePage />,
              },
              {
                path: 'delivery-notes',
                element: <DeliveryNotesPage />,
              },
              {
                path: 'delivery-notes/create',
                element: <DeliveryNoteCreatePage />,
              },
              {
                path: 'delivery-notes/edit/:id',
                element: <DeliveryNoteCreatePage />,
              },
              {
                path: 'supplier-invoices',
                element: <SupplierInvoicesPage />,
              },
              {
                path: 'upload-supplier',
                element: <SupplierInvoiceUploadPage />,
              },
              {
                path: 'expenses',
                element: <ExpensesPage />,
              },
              {
                path: 'products',
                element: <ProductsPage />,
              },
              {
                path: 'inventory',
                element: <InventoryPage />,
              },
              {
                path: 'inventory/purchase-orders',
                element: <PurchaseOrdersPage />,
              },
              {
                path: 'inventory/alerts',
                element: <StockAlertsPage />,
              },
              {
                path: 'inventory/reports',
                element: <InventoryReportsPage />,
              },
              {
                path: 'users',
                element: <UsersPage />,
              },
              {
                path: 'settings',
                element: <SettingsPage />,
              },
              {
                path: 'data-management',
                element: <DataManagementPage />,
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <LoginPage />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}