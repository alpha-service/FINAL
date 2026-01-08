import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote,
  Building2,
  AlertTriangle,
  Plus,
  Minus,
  FileText,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CashRegister() {
  const [currentShift, setCurrentShift] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showCashMovementDialog, setShowCashMovementDialog] = useState(false);
  const [showZReportDialog, setShowZReportDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [movementType, setMovementType] = useState("cash_in");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [zReport, setZReport] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchCurrentShift, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCurrentShift(), fetchShifts()]);
    setLoading(false);
  };

  const fetchCurrentShift = async () => {
    try {
      const response = await axios.get(`${API}/shifts/current`);
      if (response.data.status !== "no_shift") {
        setCurrentShift(response.data);
      } else {
        setCurrentShift(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchShifts = async () => {
    try {
      const response = await axios.get(`${API}/shifts?limit=10`);
      setShifts(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenShift = async () => {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      toast.error("Montant invalide");
      return;
    }

    try {
      await axios.post(`${API}/shifts/open`, {
        opening_cash: amount,
        cashier_name: cashierName || "Caissier"
      });
      toast.success("Caisse ouverte");
      setShowOpenDialog(false);
      setOpeningCash("");
      setCashierName("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  const handleCloseShift = async () => {
    const counted = parseFloat(countedCash);
    if (isNaN(counted) || counted < 0) {
      toast.error("Montant compté invalide");
      return;
    }

    try {
      await axios.post(`${API}/shifts/close`, {
        counted_cash: counted,
        notes: closeNotes
      });
      toast.success("Caisse fermée");
      setShowCloseDialog(false);
      setCountedCash("");
      setCloseNotes("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  const handleCashMovement = async () => {
    const amount = parseFloat(movementAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    try {
      await axios.post(`${API}/shifts/cash-movement?movement_type=${movementType}&amount=${amount}&reason=${encodeURIComponent(movementReason)}`);
      toast.success("Mouvement enregistré");
      setShowCashMovementDialog(false);
      setMovementAmount("");
      setMovementReason("");
      fetchCurrentShift();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur");
    }
  };

  const handleViewZReport = async (shiftId) => {
    try {
      const response = await axios.get(`${API}/shifts/${shiftId}/z-report`);
      setZReport(response.data);
      setShowZReportDialog(true);
    } catch (error) {
      toast.error("Erreur lors du chargement du rapport");
    }
  };

  const expectedCash = currentShift 
    ? (currentShift.opening_cash || 0) + 
      (currentShift.cash_total || 0) - 
      (currentShift.refunds_total || 0) +
      (currentShift.cash_movements?.reduce((sum, m) => 
        sum + (m.type === "cash_in" ? m.amount : -m.amount), 0) || 0)
    : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="cash-register">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Caisse / Kassa
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestion des shifts et rapports Z
          </p>
        </div>
        {!currentShift ? (
          <Button 
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setShowOpenDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ouvrir la caisse
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowCashMovementDialog(true)}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Mouvement
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setCountedCash(expectedCash.toFixed(2));
                setShowCloseDialog(true);
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Fermer la caisse
            </Button>
          </div>
        )}
      </div>

      {/* Current Shift Status */}
      {currentShift ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <h2 className="text-lg font-bold">Caisse ouverte</h2>
              <Badge className="bg-green-100 text-green-800">
                {currentShift.cashier_name || "Caissier"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Depuis {new Date(currentShift.opened_at).toLocaleTimeString("fr-BE")}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Ventes</span>
              </div>
              <p className="text-2xl font-bold">{currentShift.sales_count || 0}</p>
              <p className="text-lg font-bold text-brand-navy">€{currentShift.sales_total?.toFixed(2) || "0.00"}</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <Banknote className="w-4 h-4" />
                <span className="text-sm">Espèces</span>
              </div>
              <p className="text-2xl font-bold text-green-700">€{currentShift.cash_total?.toFixed(2) || "0.00"}</p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 mb-1">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Carte</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">€{currentShift.card_total?.toFixed(2) || "0.00"}</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 text-purple-700 mb-1">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Virement</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">€{currentShift.transfer_total?.toFixed(2) || "0.00"}</p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Fond de caisse</p>
              <p className="text-lg font-bold">€{currentShift.opening_cash?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remboursements</p>
              <p className="text-lg font-bold text-red-600">-€{currentShift.refunds_total?.toFixed(2) || "0.00"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Espèces attendues</p>
              <p className="text-lg font-bold text-brand-navy">€{expectedCash.toFixed(2)}</p>
            </div>
          </div>

          {/* Cash Movements */}
          {currentShift.cash_movements?.length > 1 && (
            <>
              <Separator className="my-6" />
              <h3 className="font-bold mb-3">Mouvements de caisse</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {currentShift.cash_movements.slice(1).map((movement, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      {movement.type === "cash_in" ? (
                        <Plus className="w-4 h-4 text-green-600" />
                      ) : (
                        <Minus className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm">{movement.reason || movement.type}</span>
                    </div>
                    <span className={`font-bold ${movement.type === "cash_in" ? "text-green-600" : "text-red-600"}`}>
                      {movement.type === "cash_in" ? "+" : "-"}€{movement.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <div>
              <h2 className="font-bold text-amber-800">Caisse fermée</h2>
              <p className="text-sm text-amber-700">Ouvrez la caisse pour commencer à enregistrer des ventes</p>
            </div>
          </div>
        </div>
      )}

      {/* Previous Shifts */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-heading font-bold">Historique des caisses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Date</th>
                <th className="text-left p-4 text-sm font-medium">Caissier</th>
                <th className="text-right p-4 text-sm font-medium">Ventes</th>
                <th className="text-right p-4 text-sm font-medium">Espèces</th>
                <th className="text-right p-4 text-sm font-medium">Carte</th>
                <th className="text-right p-4 text-sm font-medium">Écart</th>
                <th className="text-center p-4 text-sm font-medium">Statut</th>
                <th className="text-right p-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.filter(s => s.status === "closed").map((shift) => (
                <tr key={shift.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-sm">
                    {new Date(shift.opened_at).toLocaleDateString("fr-BE")}
                    <br />
                    <span className="text-muted-foreground text-xs">
                      {new Date(shift.opened_at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })} - 
                      {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </td>
                  <td className="p-4">{shift.cashier_name || "—"}</td>
                  <td className="p-4 text-right font-bold">€{shift.sales_total?.toFixed(2)}</td>
                  <td className="p-4 text-right">€{shift.cash_total?.toFixed(2)}</td>
                  <td className="p-4 text-right">€{shift.card_total?.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <span className={shift.discrepancy === 0 ? "text-green-600" : shift.discrepancy > 0 ? "text-blue-600" : "text-red-600"}>
                      {shift.discrepancy > 0 ? "+" : ""}€{shift.discrepancy?.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Badge className="bg-slate-100 text-slate-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Fermé
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewZReport(shift.id)}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Rapport Z
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ouvrir la caisse</DialogTitle>
            <DialogDescription>
              Entrez le montant du fond de caisse
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom du caissier</label>
              <Input
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Ex: Jean"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Fond de caisse</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  type="number"
                  step="0.01"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="pl-8"
                  placeholder="100.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenDialog(false)}>Annuler</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleOpenShift}>
              Ouvrir la caisse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fermer la caisse</DialogTitle>
            <DialogDescription>
              Comptez les espèces et fermez la caisse
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Espèces attendues</p>
              <p className="text-2xl font-bold text-brand-navy">€{expectedCash.toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Espèces comptées</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  type="number"
                  step="0.01"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            {countedCash && (
              <div className={`p-3 rounded-lg ${parseFloat(countedCash) - expectedCash === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                Écart: {parseFloat(countedCash) - expectedCash >= 0 ? "+" : ""}€{(parseFloat(countedCash) - expectedCash).toFixed(2)}
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Notes (optionnel)</label>
              <Textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Remarques sur la journée..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Annuler</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleCloseShift}>
              Fermer la caisse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Movement Dialog */}
      <Dialog open={showCashMovementDialog} onOpenChange={setShowCashMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mouvement de caisse</DialogTitle>
            <DialogDescription>
              Entrée ou sortie d'espèces
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={movementType} onValueChange={setMovementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_in">Entrée (Cash In)</SelectItem>
                  <SelectItem value="cash_out">Sortie (Cash Out)</SelectItem>
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
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Raison</label>
              <Input
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder="Ex: Dépôt banque, Petite caisse..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashMovementDialog(false)}>Annuler</Button>
            <Button onClick={handleCashMovement}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Z Report Dialog */}
      <Dialog open={showZReportDialog} onOpenChange={setShowZReportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rapport Z / Z-Rapport</DialogTitle>
            <DialogDescription>
              {zReport && new Date(zReport.opened_at).toLocaleDateString("fr-BE")}
            </DialogDescription>
          </DialogHeader>
          {zReport && (
            <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Caissier</p>
                  <p className="font-bold">{zReport.cashier || "—"}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Nombre de ventes</p>
                  <p className="font-bold">{zReport.sales_count}</p>
                </div>
              </div>

              <div className="p-4 bg-brand-navy/5 rounded-lg">
                <h4 className="font-bold mb-3">Totaux par méthode de paiement</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Espèces</p>
                    <p className="text-xl font-bold text-green-600">€{zReport.cash_total?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Carte</p>
                    <p className="text-xl font-bold text-blue-600">€{zReport.card_total?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Virement</p>
                    <p className="text-xl font-bold text-purple-600">€{zReport.transfer_total?.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-bold mb-3">TVA collectée</h4>
                {zReport.vat_breakdown && Object.entries(zReport.vat_breakdown).map(([rate, data]) => (
                  <div key={rate} className="flex justify-between py-1">
                    <span>TVA {rate}%</span>
                    <span>Base: €{data.base?.toFixed(2)} | TVA: €{data.vat?.toFixed(2)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold">
                  <span>Total TVA</span>
                  <span>€{zReport.vat_collected?.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total ventes</p>
                  <p className="text-2xl font-bold text-green-700">€{zReport.sales_total?.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Remboursements</p>
                  <p className="text-2xl font-bold text-red-700">-€{zReport.refunds_total?.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-bold mb-3">Caisse</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Fond de caisse</span>
                    <span>€{zReport.opening_cash?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Espèces attendues</span>
                    <span>€{zReport.closing_cash?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Espèces comptées</span>
                    <span>€{zReport.counted_cash?.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className={`flex justify-between font-bold ${zReport.discrepancy === 0 ? "text-green-600" : "text-amber-600"}`}>
                    <span>Écart</span>
                    <span>{zReport.discrepancy >= 0 ? "+" : ""}€{zReport.discrepancy?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              Imprimer
            </Button>
            <Button onClick={() => setShowZReportDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
