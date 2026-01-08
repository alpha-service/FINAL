import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { 
  ShoppingCart, 
  FileText, 
  History, 
  Calculator, 
  Package, 
  Settings,
  Menu,
  X,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NAV_ITEMS = [
  { path: "/pos", label: "Caisse / Kassa", labelShort: "POS", icon: ShoppingCart },
  { path: "/sales", label: "Ventes / Verkopen", labelShort: "Ventes", icon: History },
  { path: "/documents", label: "Documents", labelShort: "Docs", icon: FileText },
  { path: "/cash-register", label: "Caisse / Register", labelShort: "Caisse", icon: Calculator },
  { path: "/inventory", label: "Stock / Voorraad", labelShort: "Stock", icon: Package },
  { path: "/settings", label: "Paramètres / Instellingen", labelShort: "Config", icon: Settings },
];

export default function MainLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [stockAlerts, setStockAlerts] = useState(0);

  useEffect(() => {
    fetchShiftStatus();
    fetchStockAlerts();
    const interval = setInterval(() => {
      fetchShiftStatus();
      fetchStockAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchShiftStatus = async () => {
    try {
      const response = await axios.get(`${API}/shifts/current`);
      if (response.data.status !== "no_shift") {
        setCurrentShift(response.data);
      } else {
        setCurrentShift(null);
      }
    } catch (error) {
      console.error("Error fetching shift:", error);
    }
  };

  const fetchStockAlerts = async () => {
    try {
      const response = await axios.get(`${API}/stock-alerts`);
      setStockAlerts(response.data.length);
    } catch (error) {
      console.error("Error fetching stock alerts:", error);
    }
  };

  // Full screen for POS
  if (location.pathname === "/pos") {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-md"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-brand-navy text-white transform transition-transform duration-200 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-brand-navy font-heading font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg leading-tight">ALPHA&CO</h1>
              <p className="text-xs text-slate-300">POS System</p>
            </div>
          </div>
        </div>

        {/* Shift Status */}
        <div className="p-4 border-b border-white/10">
          <div className={cn(
            "p-3 rounded-lg text-sm",
            currentShift ? "bg-green-500/20 text-green-200" : "bg-amber-500/20 text-amber-200"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                currentShift ? "bg-green-400" : "bg-amber-400"
              )} />
              <span className="font-medium">
                {currentShift ? "Caisse ouverte" : "Caisse fermée"}
              </span>
            </div>
            {currentShift && (
              <p className="mt-1 text-xs opacity-80">
                {currentShift.cashier_name || "Caissier"} • €{currentShift.sales_total?.toFixed(2) || "0.00"}
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {item.path === "/inventory" && stockAlerts > 0 && (
                <Badge className="bg-red-500 text-white">{stockAlerts}</Badge>
              )}
              <ChevronRight className="w-4 h-4 opacity-50" />
            </NavLink>
          ))}
        </nav>

        {/* Stock Alerts Warning */}
        {stockAlerts > 0 && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-amber-300 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{stockAlerts} produits en stock faible</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10 text-xs text-slate-400">
          <p>Ninoofsesteenweg 77-79</p>
          <p>1700 Dilbeek</p>
          <p className="mt-1">TVA: BE 1028.386.674</p>
        </div>
      </aside>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-brand-gray">
        <Outlet />
      </main>
    </div>
  );
}
