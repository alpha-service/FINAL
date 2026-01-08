import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search, 
  Filter, 
  Eye, 
  Printer, 
  Copy, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  CreditCard,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  paid: "bg-green-100 text-green-800",
  unpaid: "bg-red-100 text-red-800",
  partially_paid: "bg-amber-100 text-amber-800",
  draft: "bg-slate-100 text-slate-800",
  cancelled: "bg-gray-100 text-gray-800",
  credited: "bg-purple-100 text-purple-800",
};

const STATUS_LABELS = {
  paid: "Payé / Betaald",
  unpaid: "Impayé / Onbetaald",
  partially_paid: "Partiel / Gedeeltelijk",
  draft: "Brouillon / Ontwerp",
  cancelled: "Annulé / Geannuleerd",
  credited: "Crédité / Gecrediteerd",
};

export default function SalesHistory() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);

  useEffect(() => {
    fetchSales();
  }, [statusFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("doc_type", "invoice");
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery) params.append("search", searchQuery);
      
      const [invoices, receipts] = await Promise.all([
        axios.get(`${API}/documents?doc_type=invoice&limit=200`),
        axios.get(`${API}/documents?doc_type=receipt&limit=200`)
      ]);
      
      const allSales = [...invoices.data, ...receipts.data]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setSales(allSales);
    } catch (error) {
      toast.error("Erreur de chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchSales();
  };

  const filteredSales = sales.filter(sale => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        sale.number?.toLowerCase().includes(q) ||
        sale.customer_name?.toLowerCase().includes(q) ||
        sale.items?.some(item => item.sku?.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter !== "all" && sale.status !== statusFilter) return false;
    
    // Payment method filter
    if (paymentFilter !== "all") {
      const hasPaymentMethod = sale.payments?.some(p => p.method === paymentFilter);
      if (!hasPaymentMethod) return false;
    }
    
    // Channel filter (Store vs Online from Shopify)
    if (channelFilter !== "all") {
      const saleChannel = sale.channel || "store";
      if (saleChannel !== channelFilter) return false;
    }
    
    // Date range filter
    if (dateFrom) {
      const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
      if (saleDate < dateFrom) return false;
    }
    if (dateTo) {
      const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
      if (saleDate > dateTo) return false;
    }
    
    return true;
  });

  const handleDuplicate = async (sale) => {
    try {
      const response = await axios.post(`${API}/documents/${sale.id}/duplicate`);
      toast.success(`Document dupliqué: ${response.data.number}`);
      navigate(`/documents/${response.data.id}`);
    } catch (error) {
      toast.error("Erreur lors de la duplication");
    }
  };

  const handleReturn = (sale) => {
    setSelectedSale(sale);
    setReturnItems(sale.items.map(item => ({ ...item, returnQty: 0, reason: "" })));
    setShowReturnDialog(true);
  };

  const processReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.returnQty > 0);
    if (itemsToReturn.length === 0) {
      toast.error("Sélectionnez des articles à retourner");
      return;
    }

    try {
      const response = await axios.post(`${API}/returns`, {
        original_document_id: selectedSale.id,
        items: itemsToReturn.map(item => ({
          original_item_id: item.id,
          product_id: item.product_id,
          sku: item.sku,
          name: item.name,
          qty: item.returnQty,
          unit_price: Math.abs(item.unit_price),
          vat_rate: item.vat_rate,
          reason: item.reason
        })),
        refund_method: "cash",
        notes: "Retour depuis l'historique des ventes"
      });

      toast.success(`Note de crédit créée: ${response.data.number}`);
      setShowReturnDialog(false);
      fetchSales();
    } catch (error) {
      toast.error("Erreur lors du retour");
      console.error(error);
    }
  };

  return (
    <div className="p-6" data-testid="sales-history">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-brand-navy">
          Historique des ventes / Verkoopgeschiedenis
        </h1>
        <p className="text-muted-foreground mt-1">
          Consultez et gérez vos ventes passées
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="N° facture, client, SKU..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-sales"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="status-filter">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="unpaid">Impayé</SelectItem>
              <SelectItem value="partially_paid">Partiel</SelectItem>
              <SelectItem value="credited">Crédité</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Paiement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les paiements</SelectItem>
              <SelectItem value="cash">Espèces</SelectItem>
              <SelectItem value="card">Carte</SelectItem>
              <SelectItem value="bank_transfer">Virement</SelectItem>
            </SelectContent>
          </Select>

          <Button type="submit" variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
          </Button>
        </form>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-medium text-sm">N° Document</th>
                <th className="text-left p-4 font-medium text-sm">Date</th>
                <th className="text-left p-4 font-medium text-sm">Client</th>
                <th className="text-left p-4 font-medium text-sm">Articles</th>
                <th className="text-right p-4 font-medium text-sm">Total</th>
                <th className="text-center p-4 font-medium text-sm">Statut</th>
                <th className="text-center p-4 font-medium text-sm">Paiement</th>
                <th className="text-right p-4 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Aucune vente trouvée
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`sale-row-${sale.id}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-navy" />
                        <span className="font-mono font-medium">{sale.number}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(sale.created_at).toLocaleDateString("fr-BE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{sale.customer_name || "Client comptoir"}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {sale.items?.length || 0} article(s)
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-brand-navy">
                        €{sale.total?.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={STATUS_COLORS[sale.status]}>
                        {STATUS_LABELS[sale.status] || sale.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {sale.payments?.map((p, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {p.method === "cash" ? "💵" : p.method === "card" ? "💳" : "🏦"}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/documents/${sale.id}`)}
                          title="Voir"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.print()}
                          title="Imprimer"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(sale)}
                          title="Dupliquer"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {sale.status !== "credited" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReturn(sale)}
                            title="Retour"
                            className="text-red-500 hover:text-red-600"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination placeholder */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredSales.length} vente(s) affichée(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Retour / Terugkeer - {selectedSale?.number}</DialogTitle>
            <DialogDescription>
              Sélectionnez les articles à retourner et la quantité
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {returnItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.sku} • Qté originale: {item.qty} • €{Math.abs(item.unit_price).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={item.qty}
                    value={item.returnQty}
                    onChange={(e) => {
                      const newItems = [...returnItems];
                      newItems[idx].returnQty = Math.min(parseInt(e.target.value) || 0, item.qty);
                      setReturnItems(newItems);
                    }}
                    className="w-20"
                  />
                  <Input
                    placeholder="Raison"
                    value={item.reason}
                    onChange={(e) => {
                      const newItems = [...returnItems];
                      newItems[idx].reason = e.target.value;
                      setReturnItems(newItems);
                    }}
                    className="w-32"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Annuler
            </Button>
            <Button 
              className="bg-red-500 hover:bg-red-600"
              onClick={processReturn}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Créer note de crédit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
