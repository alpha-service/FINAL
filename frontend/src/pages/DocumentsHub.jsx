import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  Filter, 
  Eye, 
  Printer, 
  Download,
  FileText,
  FileCheck,
  Receipt,
  FileMinus,
  Truck,
  CreditCard,
  ArrowRight,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateReceiptPDF } from "@/utils/pdfGenerator";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DOC_TYPE_CONFIG = {
  quote: { label: "Devis / Offerte", icon: FileText, color: "bg-blue-100 text-blue-800" },
  invoice: { label: "Facture / Factuur", icon: FileCheck, color: "bg-green-100 text-green-800" },
  receipt: { label: "Ticket / Kassabon", icon: Receipt, color: "bg-slate-100 text-slate-800" },
  proforma: { label: "Proforma", icon: FileText, color: "bg-purple-100 text-purple-800" },
  credit_note: { label: "Note crédit / Creditnota", icon: FileMinus, color: "bg-red-100 text-red-800" },
  delivery_note: { label: "Bon livraison / Leveringsbon", icon: Truck, color: "bg-amber-100 text-amber-800" },
};

const STATUS_CONFIG = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-700" },
  unpaid: { label: "Impayé", color: "bg-red-100 text-red-700" },
  partially_paid: { label: "Partiel", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Payé", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-700" },
  credited: { label: "Crédité", color: "bg-purple-100 text-purple-700" },
};

export default function DocumentsHub() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchDocuments();
  }, [activeTab, statusFilter]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.append("doc_type", activeTab);
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "200");
      
      const response = await axios.get(`${API}/documents?${params}`);
      setDocuments(response.data);
    } catch (error) {
      toast.error("Erreur de chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.number?.toLowerCase().includes(q) ||
      doc.customer_name?.toLowerCase().includes(q)
    );
  });

  const handleConvertToInvoice = async (doc) => {
    try {
      const response = await axios.post(`${API}/documents/${doc.id}/convert?target_type=invoice`);
      toast.success(`Converti en facture: ${response.data.number}`);
      fetchDocuments();
      navigate(`/documents/${response.data.id}`);
    } catch (error) {
      toast.error("Erreur lors de la conversion");
    }
  };

  const handleDownloadPDF = (doc) => {
    generateReceiptPDF(doc, null);
    toast.success("PDF téléchargé");
  };

  const getDocTypeStats = () => {
    const stats = {};
    documents.forEach(doc => {
      stats[doc.doc_type] = (stats[doc.doc_type] || 0) + 1;
    });
    return stats;
  };

  const stats = getDocTypeStats();

  return (
    <div className="p-6" data-testid="documents-hub">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Documents
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez tous vos documents commerciaux
          </p>
        </div>
        <Button 
          className="bg-brand-orange hover:bg-brand-orange/90"
          onClick={() => navigate("/pos")}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle vente
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {Object.entries(DOC_TYPE_CONFIG).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`p-4 rounded-lg border transition-all ${
                activeTab === type 
                  ? "border-brand-navy bg-brand-navy/5" 
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-brand-navy" />
                <span className="font-bold text-lg">{stats[type] || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{config.label}</p>
            </button>
          );
        })}
      </div>

      {/* Tabs & Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="quote">Devis</TabsTrigger>
              <TabsTrigger value="invoice">Factures</TabsTrigger>
              <TabsTrigger value="receipt">Tickets</TabsTrigger>
              <TabsTrigger value="credit_note">Crédits</TabsTrigger>
            </TabsList>

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="unpaid">Impayé</SelectItem>
                <SelectItem value="partially_paid">Partiel</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="credited">Crédité</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Documents Table */}
        <TabsContent value={activeTab} className="mt-0">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm">Type</th>
                    <th className="text-left p-4 font-medium text-sm">N° Document</th>
                    <th className="text-left p-4 font-medium text-sm">Date</th>
                    <th className="text-left p-4 font-medium text-sm">Client</th>
                    <th className="text-right p-4 font-medium text-sm">Total</th>
                    <th className="text-right p-4 font-medium text-sm">Payé</th>
                    <th className="text-center p-4 font-medium text-sm">Statut</th>
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
                  ) : filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Aucun document trouvé
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => {
                      const typeConfig = DOC_TYPE_CONFIG[doc.doc_type] || {};
                      const statusConfig = STATUS_CONFIG[doc.status] || {};
                      const TypeIcon = typeConfig.icon || FileText;
                      
                      return (
                        <tr 
                          key={doc.id} 
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/documents/${doc.id}`)}
                        >
                          <td className="p-4">
                            <Badge className={typeConfig.color}>
                              <TypeIcon className="w-3 h-3 mr-1" />
                              {typeConfig.label?.split(" / ")[0]}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-medium">{doc.number}</span>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString("fr-BE")}
                          </td>
                          <td className="p-4">
                            {doc.customer_name || "—"}
                          </td>
                          <td className="p-4 text-right font-bold">
                            €{doc.total?.toFixed(2)}
                          </td>
                          <td className="p-4 text-right">
                            €{doc.paid_total?.toFixed(2)}
                          </td>
                          <td className="p-4 text-center">
                            <Badge className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                          </td>
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/documents/${doc.id}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadPDF(doc)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              {doc.doc_type === "quote" && doc.status !== "accepted" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleConvertToInvoice(doc)}
                                  className="text-brand-orange"
                                  title="Convertir en facture"
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </Button>
                              )}
                              {["unpaid", "partially_paid"].includes(doc.status) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/documents/${doc.id}`)}
                                  className="text-green-600"
                                  title="Encaisser"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </Button>
                              )}
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
                {filteredDocuments.length} document(s)
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
