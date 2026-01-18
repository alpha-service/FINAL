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
  AlertCircle,
  Users,
  UserCog,
  BarChart3,
  ChevronLeft,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useDesign, DESIGNS } from "@/hooks/useDesign";
import ThemeSelector from "@/components/ThemeSelector";
import DesignSelector from "@/components/DesignSelector";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NAV_ITEMS = [
  { path: "/pos", label: "Caisse / Kassa", labelShort: "POS", icon: ShoppingCart, title: "Point de Vente" },
  { path: "/sales", label: "Ventes / Verkopen", labelShort: "Ventes", icon: History, title: "Historique Ventes" },
  { path: "/documents", label: "Documents", labelShort: "Docs", icon: FileText, title: "Documents" },
  { path: "/products", label: "Produits / Producten", labelShort: "Produits", icon: Package, title: "Produits" },
  { path: "/clients", label: "Clients / Klanten", labelShort: "Clients", icon: Users, title: "Clients" },
  { path: "/reports", label: "Rapports / Rapporten", labelShort: "Rapports", icon: BarChart3, title: "Rapports" },
  { path: "/cash-register", label: "Caisse / Register", labelShort: "Caisse", icon: Calculator, title: "Caisse" },
  { path: "/inventory", label: "Stock / Voorraad", labelShort: "Stock", icon: Package, title: "Inventaire" },
  { path: "/users", label: "Utilisateurs / Gebruikers", labelShort: "Users", icon: UserCog, title: "Utilisateurs" },
  { path: "/settings", label: "Paramètres / Instellingen", labelShort: "Config", icon: Settings, title: "Paramètres" },
];

export default function MainLayout() {
  const location = useLocation();
  const { colors } = useTheme();
  const { currentDesign, design } = useDesign();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    const saved = localStorage.getItem('sidebar_pinned');
    return saved === null ? true : saved === 'true';
  });
  const [isHovering, setIsHovering] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [stockAlerts, setStockAlerts] = useState(0);

  const showSidebar = sidebarOpen || sidebarPinned || isHovering;
  
  // Design-specific classes
  const getSidebarClasses = () => {
    switch (currentDesign) {
      case DESIGNS.MODERN:
        return "bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 backdrop-blur-xl border-r border-white/10";
      case DESIGNS.MINIMAL:
        return "bg-neutral-900 border-r-2 border-black";
      default:
        return "";
    }
  };
  
  const getNavItemClasses = (isActive) => {
    switch (currentDesign) {
      case DESIGNS.MODERN:
        return cn(
          "flex items-center gap-3 px-4 py-3 mb-1 transition-all duration-300",
          design.navItemStyle,
          isActive
            ? "bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-white shadow-lg shadow-purple-500/20 border border-white/10"
            : "text-slate-300 hover:bg-white/10 hover:text-white hover:translate-x-1"
        );
      case DESIGNS.MINIMAL:
        return cn(
          "flex items-center gap-3 px-4 py-2.5 mb-0.5 transition-colors duration-150",
          design.navItemStyle,
          isActive
            ? "border-l-white bg-white/5 text-white"
            : "text-neutral-400 hover:bg-white/5 hover:text-white hover:border-l-neutral-500"
        );
      default:
        return cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 transition-colors text-xs",
          isActive
            ? "bg-white/10 text-white"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        );
    }
  };

  useEffect(() => {
    fetchShiftStatus();
    fetchStockAlerts();
    const interval = setInterval(() => {
      fetchShiftStatus();
      fetchStockAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_pinned', sidebarPinned.toString());
  }, [sidebarPinned]);

  // Update page title based on current route
  useEffect(() => {
    const currentItem = NAV_ITEMS.find(item => location.pathname.startsWith(item.path));
    const pageTitle = currentItem?.title || "ALPHA POS";
    document.title = `${pageTitle} - ALPHA POS`;
  }, [location.pathname]);

  const toggleSidebarPin = () => {
    setSidebarPinned(!sidebarPinned);
    if (sidebarPinned) {
      setSidebarOpen(false);
    }
  };

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Hover trigger zone - left edge */}
      {!sidebarPinned && (
        <div
          className="fixed left-0 top-0 bottom-0 w-1 z-50 hidden lg:block"
          onMouseEnter={() => setIsHovering(true)}
        />
      )}

      {/* Desktop sidebar toggle button - only show when sidebar is hidden */}
      {!showSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 hidden lg:flex bg-white shadow-lg hover:bg-brand-navy hover:text-white transition-colors"
          onClick={() => {
            setSidebarOpen(true);
            setSidebarPinned(true);
          }}
          title="Afficher le menu / Toon menu"
        >
          <PanelLeft className="w-5 h-5" />
        </Button>
      )}

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
          "fixed top-0 left-0 bottom-0 z-40 text-white transform transition-all duration-300 ease-in-out overflow-y-auto",
          "lg:shadow-2xl",
          showSidebar ? "translate-x-0" : "-translate-x-full",
          design.sidebarWidth,
          getSidebarClasses()
        )}
        style={{ backgroundColor: currentDesign === DESIGNS.CLASSIC ? colors.sidebar : undefined }}
        onMouseLeave={() => {
          if (!sidebarPinned) {
            setIsHovering(false);
            setSidebarOpen(false);
          }
        }}
      >
        {/* Logo */}
        <div className={cn(
          "p-3 border-b",
          currentDesign === DESIGNS.MODERN ? "border-white/10" : 
          currentDesign === DESIGNS.MINIMAL ? "border-neutral-700" : "border-white/10"
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center",
                currentDesign === DESIGNS.MODERN ? "w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg" :
                currentDesign === DESIGNS.MINIMAL ? "w-8 h-8 bg-white" : "w-8 h-8 bg-white rounded-lg"
              )}>
                <span className={cn(
                  "font-heading font-bold",
                  currentDesign === DESIGNS.MODERN ? "text-white text-lg" :
                  currentDesign === DESIGNS.MINIMAL ? "text-black text-sm" : "text-brand-navy text-base"
                )}>A</span>
              </div>
              <div>
                <h1 className={cn(
                  "font-heading leading-tight",
                  currentDesign === DESIGNS.MODERN ? "font-semibold text-base" :
                  currentDesign === DESIGNS.MINIMAL ? "font-normal text-sm tracking-widest" : "font-bold text-sm"
                )}>ALPHA&CO</h1>
                <p className={cn(
                  "text-slate-300",
                  currentDesign === DESIGNS.MODERN ? "text-xs opacity-70" :
                  currentDesign === DESIGNS.MINIMAL ? "text-[9px] tracking-wider text-neutral-500" : "text-[10px]"
                )}>
                  {currentDesign === DESIGNS.MINIMAL ? "POS" : "POS System"}
                </p>
              </div>
            </div>
            {/* Pin, Theme and Design buttons - Desktop only */}
            <div className="hidden lg:flex items-center gap-0.5">
              <DesignSelector variant="ghost" size="icon" />
              <ThemeSelector variant="ghost" size="icon" />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/10"
                onClick={toggleSidebarPin}
                title={sidebarPinned ? "Masquer automatiquement" : "Garder visible"}
              >
                {sidebarPinned ? (
                  <PanelLeftClose className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Shift Status */}
        <div className={cn(
          "p-2 border-b",
          currentDesign === DESIGNS.MODERN ? "border-white/10" :
          currentDesign === DESIGNS.MINIMAL ? "border-neutral-700 p-3" : "border-white/10"
        )}>
          <div className={cn(
            "p-2 text-xs",
            currentShift 
              ? (currentDesign === DESIGNS.MODERN ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-200 rounded-xl border border-green-500/20" :
                 currentDesign === DESIGNS.MINIMAL ? "bg-green-500/10 text-green-300 border-l-2 border-green-500" : 
                 "bg-green-500/20 text-green-200 rounded-lg")
              : (currentDesign === DESIGNS.MODERN ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-200 rounded-xl border border-amber-500/20" :
                 currentDesign === DESIGNS.MINIMAL ? "bg-amber-500/10 text-amber-300 border-l-2 border-amber-500" :
                 "bg-amber-500/20 text-amber-200 rounded-lg")
          )}>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                currentShift ? "bg-green-400" : "bg-amber-400",
                currentDesign === DESIGNS.MODERN && "animate-pulse"
              )} />
              <span className="font-medium text-xs">
                {currentShift ? "Caisse ouverte" : "Caisse fermée"}
              </span>
            </div>
            {currentShift && (
              <p className="mt-0.5 text-[10px] opacity-80">
                {currentShift.cashier_name || "Caissier"} • €{currentShift.sales_total?.toFixed(2) || "0.00"}
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto",
          currentDesign === DESIGNS.MODERN ? "p-2" :
          currentDesign === DESIGNS.MINIMAL ? "p-0" : "p-1.5"
        )}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => getNavItemClasses(isActive)}
            >
              <item.icon className={design.iconSize} />
              <span className="flex-1">{item.label}</span>
              {item.path === "/inventory" && stockAlerts > 0 && (
                <Badge className={cn(
                  "text-white text-[10px] h-4",
                  currentDesign === DESIGNS.MODERN ? "bg-gradient-to-r from-red-500 to-pink-500" :
                  currentDesign === DESIGNS.MINIMAL ? "bg-red-600 rounded-none" : "bg-red-500"
                )}>{stockAlerts}</Badge>
              )}
              {currentDesign !== DESIGNS.MINIMAL && (
                <ChevronRight className="w-3 h-3 opacity-50" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Stock Alerts Warning */}
        {stockAlerts > 0 && (
          <div className="p-2 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>{stockAlerts} stock faible</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-2 border-t border-white/10 text-[10px] text-slate-400">
          <p>Ninoofsesteenweg 77-79</p>
          <p>1700 Dilbeek</p>
          <p className="mt-1">TVA: BE 1028.386.674</p>
        </div>
      </aside>

      {/* Backdrop - Only on mobile */}
      {sidebarOpen && !sidebarPinned && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
            setIsHovering(false);
          }}
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-y-auto transition-all duration-300",
        currentDesign === DESIGNS.MODERN ? "bg-gradient-to-br from-slate-100 via-purple-50 to-slate-100" :
        currentDesign === DESIGNS.MINIMAL ? "bg-neutral-100" : "bg-brand-gray",
        sidebarPinned && (
          currentDesign === DESIGNS.MODERN ? "lg:ml-72" :
          currentDesign === DESIGNS.MINIMAL ? "lg:ml-56" : "lg:ml-64"
        )
      )}>
        <Outlet />
      </main>
    </div>
  );
}
