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
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const statsCards = [
    { 
      title: "Ventes totales", 
      value: "€0.00", 
      change: "+0%", 
      icon: DollarSign,
      color: "text-green-600"
    },
    { 
      title: "Transactions", 
      value: "0", 
      change: "+0%", 
      icon: FileText,
      color: "text-blue-600"
    },
    { 
      title: "Produits vendus", 
      value: "0", 
      change: "+0%", 
      icon: Package,
      color: "text-purple-600"
    },
    { 
      title: "Clients actifs", 
      value: "0", 
      change: "+0%", 
      icon: Users,
      color: "text-amber-600"
    },
  ];

  const handleGenerateReport = () => {
    toast.info("Génération du rapport...");
    // TODO: Implement actual report generation
  };

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
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune donnée disponible pour cette période</p>
          </div>
        </div>

        {/* Sales by Payment Method */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Ventes par mode de paiement</h2>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune donnée disponible pour cette période</p>
          </div>
        </div>

        {/* Daily Sales Trend */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Évolution des ventes</h2>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune donnée disponible pour cette période</p>
          </div>
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
