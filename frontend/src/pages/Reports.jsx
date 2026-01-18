import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  Package,
  FileText,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  ShoppingCart,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [dashboardData, setDashboardData] = useState(null);
  const [vatData, setVatData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [dashRes, vatRes, invRes] = await Promise.all([
        axios.get(`${API}/reports/dashboard?date_from=${dateFrom}&date_to=${dateTo}`),
        axios.get(`${API}/reports/vat?date_from=${dateFrom}&date_to=${dateTo}`),
        axios.get(`${API}/reports/inventory`)
      ]);
      setDashboardData(dashRes.data);
      setVatData(vatRes.data);
      setInventoryData(invRes.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erreur lors du chargement des rapports");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
    fetchReports();
    toast.success("Rapport généré");
  };

  const handleExport = () => {
    if (!dashboardData) return;
    
    let csv = "Rapport de ventes\n";
    csv += `Période: ${dateFrom} - ${dateTo}\n\n`;
    csv += `Total ventes,${dashboardData.summary.total_sales}\n`;
    csv += `Transactions,${dashboardData.summary.transactions_count}\n`;
    csv += `Produits vendus,${dashboardData.summary.products_sold}\n\n`;
    
    csv += "Top Produits\n";
    csv += "Nom,Quantité,Revenue\n";
    dashboardData.top_products.forEach(p => {
      csv += `"${p.name}",${p.qty},${p.revenue.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${dateFrom}_${dateTo}.csv`;
    a.click();
    toast.success("Rapport exporté");
  };

  const statsCards = dashboardData ? [
    { 
      title: "Ventes totales", 
      value: `€${dashboardData.summary.total_sales.toFixed(2)}`, 
      subtitle: `Ticket moyen: €${dashboardData.summary.average_ticket.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    { 
      title: "Transactions", 
      value: dashboardData.summary.transactions_count.toString(), 
      subtitle: "Factures & tickets",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    { 
      title: "Produits vendus", 
      value: dashboardData.summary.products_sold.toString(), 
      subtitle: "Unités",
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    { 
      title: "Clients actifs", 
      value: dashboardData.summary.active_customers.toString(), 
      subtitle: "Sur la période",
      icon: Users,
      color: "text-amber-600",
      bgColor: "bg-amber-50"
    },
  ] : [];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="reports">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Rapports / Rapporten
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyses et statistiques de ventes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
          <Button className="bg-brand-orange hover:bg-brand-orange/90">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Période:</span>
          </div>
          <Input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground">à</span>
          <Input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
          <Button onClick={handleGenerateReport}>
            Générer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {statsCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-slate-50 ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-green-600">{stat.change}</span>
              </div>
              <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-brand-navy">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Report Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Package className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Top Produits</h2>
          </div>
          {dashboardData?.top_products?.length > 0 ? (
            <div className="space-y-3">
              {dashboardData.top_products.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-brand-navy text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-navy">€{product.revenue.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{product.qty} vendus</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune donnée disponible pour cette période</p>
            </div>
          )}
        </div>

        {/* Sales by Payment Method */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Ventes par mode de paiement</h2>
          </div>
          {dashboardData?.payment_methods && Object.keys(dashboardData.payment_methods).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(dashboardData.payment_methods).map(([method, amount], idx) => {
                const total = Object.values(dashboardData.payment_methods).reduce((a, b) => a + b, 0);
                const percent = total > 0 ? (amount / total * 100) : 0;
                const colors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                return (
                  <div key={method} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{method}</span>
                      <span className="text-muted-foreground">€{amount.toFixed(2)} ({percent.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colors[idx % colors.length]} transition-all`} 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <PieChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune donnée disponible pour cette période</p>
            </div>
          )}
        </div>

        {/* VAT Summary */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Rapport TVA</h2>
          </div>
          {vatData?.breakdown?.length > 0 ? (
            <div className="space-y-3">
              {vatData.breakdown.map((vat, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">TVA {vat.rate}%</p>
                    <p className="text-sm text-muted-foreground">Base: €{vat.base.toFixed(2)}</p>
                  </div>
                  <p className="font-bold text-brand-navy">€{vat.amount.toFixed(2)}</p>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between pt-2">
                <span className="font-bold">Total TVA</span>
                <span className="font-bold text-brand-navy">€{vatData.total_vat.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune donnée TVA disponible</p>
            </div>
          )}
        </div>

        {/* Inventory Status */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingCart className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">État des stocks</h2>
          </div>
          {inventoryData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-brand-navy">{inventoryData.total_products}</p>
                  <p className="text-xs text-muted-foreground">Produits</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{inventoryData.low_stock_count}</p>
                  <p className="text-xs text-muted-foreground">Stock bas</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{inventoryData.out_of_stock_count}</p>
                  <p className="text-xs text-muted-foreground">Rupture</p>
                </div>
              </div>
              {inventoryData.low_stock_items?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Produits à réapprovisionner
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {inventoryData.low_stock_items.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-amber-50 rounded">
                        <span>{item.name}</span>
                        <Badge variant="outline" className="text-amber-600">{item.stock} restant</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Données d'inventaire non disponibles</p>
            </div>
          )}
        </div>

        {/* Daily Sales Trend */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Évolution des ventes</h2>
          </div>
          {dashboardData?.daily_trend?.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-end gap-1 h-40">
                {dashboardData.daily_trend.map((day, idx) => {
                  const maxValue = Math.max(...dashboardData.daily_trend.map(d => d.total));
                  const height = maxValue > 0 ? (day.total / maxValue * 100) : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group">
                      <div 
                        className="w-full bg-brand-navy/80 hover:bg-brand-navy rounded-t transition-all cursor-pointer relative"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${day.date}: €${day.total.toFixed(2)}`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-brand-navy text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          €{day.total.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 text-xs text-muted-foreground">
                {dashboardData.daily_trend.map((day, idx) => (
                  <div key={idx} className="flex-1 text-center truncate">
                    {new Date(day.date).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune donnée disponible pour cette période</p>
            </div>
          )}
        </div>
      </div>

      {/* Available Reports */}
      <div className="mt-6 bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="font-heading font-bold mb-4">Rapports disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <p className="font-medium">Rapport de caisse (Z)</p>
              <p className="text-sm text-muted-foreground">Clôture de journée</p>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <p className="font-medium">Rapport TVA</p>
              <p className="text-sm text-muted-foreground">Synthèse TVA collectée</p>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <p className="font-medium">Inventaire</p>
              <p className="text-sm text-muted-foreground">État des stocks</p>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <p className="font-medium">Clients</p>
              <p className="text-sm text-muted-foreground">Liste et soldes</p>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <p className="font-medium">Mouvements de stock</p>
              <p className="text-sm text-muted-foreground">Historique complet</p>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <p className="font-medium">Performance vendeur</p>
              <p className="text-sm text-muted-foreground">Par caissier</p>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
