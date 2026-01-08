import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  Download,
  Copy,
  ArrowRight,
  CreditCard,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DocumentViewer from "@/components/DocumentViewer";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DOC_TYPE_LABELS = {
  quote: "Devis / Offerte",
  invoice: "Facture / Factuur",
  receipt: "Ticket / Kassabon",
  proforma: "Proforma",
  credit_note: "Note de crédit / Creditnota",
  delivery_note: "Bon de livraison / Leveringsbon",
};

const STATUS_CONFIG = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-700" },
  unpaid: { label: "Impayé", color: "bg-red-100 text-red-700" },
  partially_paid: { label: "Partiellement payé", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Payé", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-700" },
  credited: { label: "Crédité", color: "bg-purple-100 text-purple-700" },
};

export default function DocumentDetail() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  useEffect(() => {
    fetchDocument();
  }, [docId]);

  const fetchDocument = async () => {
    try {
      const response = await axios.get(`${API}/documents/${docId}`);
      setDocument(response.data);
      setPaymentAmount((response.data.total - response.data.paid_total).toFixed(2));
    } catch (error) {
      toast.error("Document non trouvé");
      navigate("/documents");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    try {
      await axios.post(`${API}/documents/${docId}/pay`, {
        method: paymentMethod,
        amount: amount
      });
      toast.success("Paiement enregistré");
      setShowPaymentDialog(false);
      fetchDocument();
    } catch (error) {
      toast.error("Erreur lors du paiement");
    }
  };

  const handleConvert = async () => {
    try {
      const response = await axios.post(`${API}/documents/${docId}/convert?target_type=invoice`);
      toast.success(`Converti en facture: ${response.data.number}`);
      navigate(`/documents/${response.data.id}`);
    } catch (error) {
      toast.error("Erreur lors de la conversion");
    }
  };

  const handleDuplicate = async () => {
    try {
      const response = await axios.post(`${API}/documents/${docId}/duplicate`);
      toast.success(`Document dupliqué: ${response.data.number}`);
      navigate(`/documents/${response.data.id}`);
    } catch (error) {
      toast.error("Erreur lors de la duplication");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`${API}/documents/${docId}/pdf`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Format filename: FACTURE_260107-010.pdf
      const docTypePrefix = {
        'quote': 'DEVIS',
        'invoice': 'FACTURE',
        'receipt': 'TICKET',
        'credit_note': 'CREDIT',
        'proforma': 'PROFORMA',
        'delivery_note': 'LIVRAISON'
      };
      const prefix = docTypePrefix[document.doc_type] || 'DOCUMENT';
      const filename = `${prefix}_${document.number}.pdf`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF téléchargé");
    } catch (error) {
      console.error("PDF download error:", error);
      toast.error("Erreur lors du téléchargement du PDF");
    }
  };

  const handleOpenPDFNewTab = async () => {
    try {
      const response = await fetch(`${API}/documents/${docId}/pdf`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("PDF open error:", error);
      toast.error("Erreur lors de l'ouverture du PDF");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!document) return null;

  const remaining = document.total - document.paid_total;
  const statusConfig = STATUS_CONFIG[document.status] || {};

  return (
    <div className="p-6" data-testid="document-detail">
      {/* Header Actions */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold text-brand-navy">
              {document.number}
            </h1>
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {DOC_TYPE_LABELS[document.doc_type]} • {new Date(document.created_at).toLocaleDateString("fr-BE")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </Button>
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Dupliquer
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" onClick={handleOpenPDFNewTab}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Ouvrir PDF
          </Button>
          {document.doc_type === "quote" && document.status !== "accepted" && (
            <Button variant="outline" onClick={handleConvert}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Convertir
            </Button>
          )}
          {remaining > 0 && (
            <Button 
              className="bg-brand-orange hover:bg-brand-orange/90"
              onClick={() => setShowPaymentDialog(true)}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Encaisser
            </Button>
          )}
        </div>
      </div>

      {/* Document Viewer */}
      <DocumentViewer document={document} />

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un paiement</DialogTitle>
            <DialogDescription>
              Reste à payer: €{remaining.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Méthode</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces / Cash</SelectItem>
                  <SelectItem value="card">Carte / Kaart</SelectItem>
                  <SelectItem value="bank_transfer">Virement / Overschrijving</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Montant</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Annuler
            </Button>
            <Button 
              className="bg-brand-orange hover:bg-brand-orange/90"
              onClick={handleAddPayment}
            >
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
