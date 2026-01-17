import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Receipt,
  CreditCard,
  TrendingUp,
  Package,
  Calendar,
  Euro,
  FileCheck,
  Download,
  Eye,
  RefreshCw,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DOC_TYPE_CONFIG = {
  quote: { label: "Devis", icon: FileText, color: "bg-blue-100 text-blue-800" },
  invoice: { label: "Facture", icon: FileCheck, color: "bg-green-100 text-green-800" },
  receipt: { label: "Ticket", icon: Receipt, color: "bg-slate-100 text-slate-800" },
  credit_note: { label: "Crédit", icon: FileText, color: "bg-red-100 text-red-800" },
};

const STATUS_CONFIG = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-700" },
  unpaid: { label: "Impayé", color: "bg-red-100 text-red-700" },
  partially_paid: { label: "Partiel", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Payé", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-700" },
};

export default function CustomerHistory() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (customerId) {
      fetchHistory();
    }
  }, [customerId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/customers/${customerId}/history`);
      setData(response.data);
    } catch (error) {
      toast.error("Erreur de chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (doc) => {
    try {
      const response = await fetch(`${API}/documents/${doc.id}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.doc_type.toUpperCase()}_${doc.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("PDF téléchargé");
    } catch (error) {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleReorder = (doc) => {
    // Prepare cart from document items
    const cartItems = doc.items.map(item => ({
      product_id: item.product_id,
      sku: item.sku,
      name: item.name,
      name_nl: item.name,
      qty: item.qty,
      unit_price: item.unit_price,
      unit: item.unit || "piece",
      vat_rate: item.vat_rate,
      discount_type: null,
      discount_value: 0,
      stock_qty: 999
    }));
    
    sessionStorage.setItem('reorder_cart', JSON.stringify(cartItems));
    sessionStorage.setItem('reorder_customer_id', customerId);
    navigate('/pos');
    toast.success("Commande rechargée dans le panier");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Client non trouvé</p>
      </div>
    );
  }

  const { customer, stats, top_products, recent_documents } = data;

  return (
    <div className="p-6" data-testid="customer-history">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${customer.type === 'company' ? 'bg-blue-100' : 'bg-slate-100'}`}>
              {customer.type === 'company' ? (
                <Building2 className="w-6 h-6 text-blue-700" />
              ) : (
                <User className="w-6 h-6 text-slate-700" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-brand-navy">
                {customer.name}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {customer.vat_number && <span>TVA: {customer.vat_number}</span>}
                {customer.receive_invoices_by_peppol && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    <Globe className="w-3 h-3 mr-1" />
                    Peppol
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button className="bg-brand-orange hover:bg-brand-orange/90" onClick={() => navigate('/pos')}>
          Nouvelle vente
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Euro className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">€{stats.total_spent}</p>
                <p className="text-xs text-muted-foreground">Total dépensé</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats.total_documents}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">€{stats.average_ticket}</p>
                <p className="text-xs text-muted-foreground">Ticket moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileCheck className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-700">{stats.invoices_count}</p>
                <p className="text-xs text-muted-foreground">Factures</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Receipt className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.receipts_count}</p>
                <p className="text-xs text-muted-foreground">Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {stats.unpaid_amount > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <CreditCard className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700">€{stats.unpaid_amount}</p>
                  <p className="text-xs text-red-600">Impayé</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info & Top Products */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">
                    {customer.phone}
                  </a>
                </div>
              )}
              {(customer.street_name || customer.address) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{customer.street_name || customer.address} {customer.building_number}</p>
                    <p>{customer.postal_code} {customer.city}</p>
                    <p>{customer.country}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" />
                Produits les plus achetés
              </CardTitle>
            </CardHeader>
            <CardContent>
              {top_products?.length > 0 ? (
                <div className="space-y-2">
                  {top_products.slice(0, 5).map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.qty} unités</p>
                      </div>
                      <p className="font-bold text-brand-navy">€{product.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun achat
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Historique des documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {recent_documents?.length > 0 ? (
                  <div className="space-y-2">
                    {recent_documents.map((doc) => {
                      const DocIcon = DOC_TYPE_CONFIG[doc.doc_type]?.icon || FileText;
                      return (
                        <div 
                          key={doc.id} 
                          className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          onClick={() => navigate(`/documents/${doc.id}`)}
                        >
                          <div className={`p-2 rounded ${DOC_TYPE_CONFIG[doc.doc_type]?.color || 'bg-slate-100'}`}>
                            <DocIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium">{doc.number}</span>
                              <Badge className={STATUS_CONFIG[doc.status]?.color || 'bg-slate-100'}>
                                {STATUS_CONFIG[doc.status]?.label || doc.status}
                              </Badge>
                              {doc.peppol_sent && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  Peppol
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(doc.created_at).toLocaleDateString("fr-BE")}</span>
                              <span>•</span>
                              <span>{doc.items?.length || 0} article(s)</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-brand-navy">€{doc.total?.toFixed(2)}</p>
                            {doc.status === "unpaid" && (
                              <p className="text-xs text-red-600">À payer</p>
                            )}
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(doc)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleReorder(doc)} className="text-brand-orange">
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun document trouvé pour ce client
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
