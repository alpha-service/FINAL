import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import MainLayout from "@/components/layout/MainLayout";
import POSScreen from "@/pages/POSScreen";
import SalesHistory from "@/pages/SalesHistory";
import DocumentsHub from "@/pages/DocumentsHub";
import DocumentDetail from "@/pages/DocumentDetail";
import CashRegister from "@/pages/CashRegister";
import Inventory from "@/pages/Inventory";
import Settings from "@/pages/Settings";

function App() {
  return (
    <div className="min-h-screen bg-brand-gray font-body">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/pos" replace />} />
            <Route path="pos" element={<POSScreen />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="documents" element={<DocumentsHub />} />
            <Route path="documents/:docId" element={<DocumentDetail />} />
            <Route path="cash-register" element={<CashRegister />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
