import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import MainLayout from "@/components/layout/MainLayout";
import { DesignProvider } from "@/hooks/useDesign";

// Lazy load pages for better performance
const POSScreen = lazy(() => import("@/pages/POSScreen"));
const SalesHistory = lazy(() => import("@/pages/SalesHistory"));
const DocumentsHub = lazy(() => import("@/pages/DocumentsHub"));
const DocumentDetail = lazy(() => import("@/pages/DocumentDetail"));
const CashRegister = lazy(() => import("@/pages/CashRegister"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Settings = lazy(() => import("@/pages/Settings"));
const Products = lazy(() => import("@/pages/Products"));
const Clients = lazy(() => import("@/pages/Clients"));
const Reports = lazy(() => import("@/pages/Reports"));
const Users = lazy(() => import("@/pages/Users"));
const CustomerHistory = lazy(() => import("@/pages/CustomerHistory"));

// Loading spinner component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-navy"></div>
  </div>
);

function App() {
  return (
    <DesignProvider>
      <div className="min-h-screen bg-brand-gray font-body">
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Navigate to="/pos" replace />} />
                <Route path="pos" element={<POSScreen />} />
                <Route path="sales" element={<SalesHistory />} />
                <Route path="documents" element={<DocumentsHub />} />
                <Route path="documents/:docId" element={<DocumentDetail />} />
                <Route path="products" element={<Products />} />
                <Route path="clients" element={<Clients />} />
                <Route path="reports" element={<Reports />} />
                <Route path="cash-register" element={<CashRegister />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="users" element={<Users />} />
                <Route path="customers/:customerId/history" element={<CustomerHistory />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </div>
    </DesignProvider>
  );
}

export default App;
