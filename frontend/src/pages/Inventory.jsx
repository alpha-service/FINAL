import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Package,
  Search,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
  RefreshCw,
  Filter,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOVEMENT_LABELS = {
  sale: { label: "Vente", color: "bg-red-100 text-red-800", icon: TrendingDown },
  return: { label: "Retour", color: "bg-green-100 text-green-800", icon: TrendingUp },
  adjustment: { label: "Ajustement", color: "bg-amber-100 text-amber-800", icon: ArrowUpDown },
  purchase: { label: "Achat", color: "bg-blue-100 text-blue-800", icon: TrendingUp },
  transfer: { label: "Transfert", color: "bg-purple-100 text-purple-800", icon: RefreshCw },
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showMovementsDialog, setShowMovementsDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [productMovements, setProductMovements] = useState([]);

  useEffect(() => {
    fetchData();
  }, [categoryFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, alertsRes] = await Promise.all([
        axios.get(`${API}/products${categoryFilter !== "all" ? `?category_id=${categoryFilter}` : ""}`),
        axios.get(`${API}/categories`),
        axios.get(`${API}/stock-alerts`)
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setLowStockProducts(alertsRes.data);
    } catch (error) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.name_fr?.toLowerCase().includes(q) ||
      p.name_nl?.toLowerCase().includes(q)
    );
  });

  const handleAdjust = async () => {
    const qty = parseInt(adjustQty);
    if (isNaN(qty) || qty === 0) {
      toast.error("Quantité invalide");
      return;
    }

    try {
      await axios.post(`${API}/stock-adjustments?product_id=${selectedProduct.id}&qty_change=${qty}&reason=${encodeURIComponent(adjustReason)}`);
      toast.success("Stock ajusté");
      setShowAdjustDialog(false);
      setAdjustQty("");
      setAdjustReason("");
      fetchData();
    } catch (error) {
      toast.error("Erreur lors de l'ajustement");
    }
  };

  const handleViewMovements = async (product) => {
    setSelectedProduct(product);
    try {
      const response = await axios.get(`${API}/stock-movements?product_id=${product.id}&limit=50`);
      setProductMovements(response.data);
      setShowMovementsDialog(true);
    } catch (error) {
      toast.error("Erreur de chargement");
    }
  };

  const openAdjustDialog = (product) => {
    setSelectedProduct(product);
    setShowAdjustDialog(true);
  };

  return (
    <div className="p-6" data-testid="inventory">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Stock / Voorraad
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestion des stocks et mouvements
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-800">
                {lowStockProducts.length} produit(s) en stock faible
              </h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {lowStockProducts.slice(0, 5).map(p => (
                  <Badge key={p.id} className="bg-amber-100 text-amber-800">
                    {p.sku}: {p.stock_qty}/{p.min_stock}
                  </Badge>
                ))}
                {lowStockProducts.length > 5 && (
                  <Badge className="bg-amber-200 text-amber-900">
                    +{lowStockProducts.length - 5} autres
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="products">
        <TabsList className="mb-6">
          <TabsTrigger value="products">Produits ({products.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alertes ({lowStockProducts.length})</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="SKU, code-barres, nom..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium">SKU</th>
                    <th className="text-left p-4 text-sm font-medium">Code-barres</th>
                    <th className="text-left p-4 text-sm font-medium">Produit</th>
                    <th className="text-center p-4 text-sm font-medium">Stock</th>
                    <th className="text-center p-4 text-sm font-medium">Min</th>
                    <th className="text-center p-4 text-sm font-medium">Statut</th>
                    <th className="text-right p-4 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        Chargement...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        Aucun produit trouvé
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => {
                      const isLow = product.stock_qty <= product.min_stock;
                      return (
                        <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-4 font-mono text-sm">{product.sku}</td>
                          <td className="p-4 font-mono text-sm text-muted-foreground">
                            {product.barcode || "—"}
                          </td>
                          <td className="p-4">
                            <p className="font-medium">{product.name_fr}</p>
                            <p className="text-sm text-muted-foreground">{product.name_nl}</p>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`text-lg font-bold ${isLow ? "text-red-600" : "text-green-600"}`}>
                              {product.stock_qty}
                            </span>
                          </td>
                          <td className="p-4 text-center text-muted-foreground">
                            {product.min_stock}
                          </td>
                          <td className="p-4 text-center">
                            {isLow ? (
                              <Badge className="bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Bas
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800">OK</Badge>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewMovements(product)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openAdjustDialog(product)}
                              >
                                <ArrowUpDown className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200">
              <p className="text-sm text-muted-foreground">
                {filteredProducts.length} produit(s)
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium">SKU</th>
                    <th className="text-left p-4 text-sm font-medium">Produit</th>
                    <th className="text-center p-4 text-sm font-medium">Stock actuel</th>
                    <th className="text-center p-4 text-sm font-medium">Stock minimum</th>
                    <th className="text-center p-4 text-sm font-medium">Manque</th>
                    <th className="text-right p-4 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map(product => (
                    <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 font-mono text-sm">{product.sku}</td>
                      <td className="p-4">
                        <p className="font-medium">{product.name_fr}</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-lg font-bold text-red-600">{product.stock_qty}</span>
                      </td>
                      <td className="p-4 text-center">{product.min_stock}</td>
                      <td className="p-4 text-center">
                        <Badge className="bg-red-100 text-red-800">
                          {product.min_stock - product.stock_qty}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAdjustDialog(product)}
                        >
                          Ajuster
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuster le stock</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name_fr} ({selectedProduct?.sku})
              <br />
              Stock actuel: <strong>{selectedProduct?.stock_qty}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Quantité (+/-)</label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="Ex: +10 ou -5"
              />
              {adjustQty && (
                <p className="text-sm mt-2 text-muted-foreground">
                  Nouveau stock: <strong>{(selectedProduct?.stock_qty || 0) + parseInt(adjustQty || 0)}</strong>
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Raison</label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Ex: Inventaire, Casse, Réception..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Annuler</Button>
            <Button onClick={handleAdjust}>Ajuster</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Movements Dialog */}
      <Dialog open={showMovementsDialog} onOpenChange={setShowMovementsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mouvements de stock</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name_fr} ({selectedProduct?.sku})
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {productMovements.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun mouvement</p>
              ) : (
                productMovements.map(movement => {
                  const config = MOVEMENT_LABELS[movement.type] || {};
                  const Icon = config.icon || Package;
                  return (
                    <div key={movement.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={config.color}>
                          <Icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        <div>
                          <p className="text-sm">{movement.reason || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(movement.created_at).toLocaleString("fr-BE")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${movement.type === "sale" ? "text-red-600" : "text-green-600"}`}>
                          {movement.type === "sale" ? "-" : "+"}{movement.qty}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {movement.stock_before} → {movement.stock_after}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setShowMovementsDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
