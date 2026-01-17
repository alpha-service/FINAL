import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { 
  Search, 
  Plus,
  Edit,
  Trash2,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Filter,
  Download,
  Globe,
  CreditCard,
  FileCheck,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Clients() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    type: "individual",
    name: "",
    email: "",
    phone: "",
    // Adresse structurée pour Peppol
    street_name: "",
    building_number: "",
    postal_code: "",
    city: "",
    country: "BE",
    country_subdivision: "",
    // Identifiants légaux
    vat_number: "",
    company_id: "",
    // Peppol
    peppol_id: "",
    endpoint_id: "",
    receive_invoices_by_peppol: false,
    // Conditions commerciales
    payment_terms_days: 30,
    language: "fr",
    // Coordonnées bancaires
    bank_account_iban: "",
    bank_account_bic: "",
    bank_account_name: "",
    // Contact
    contact_name: "",
    notes: ""
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await axios.get(`${API}/customers?${params}`);
      setCustomers(response.data);
    } catch (error) {
      toast.error("Erreur de chargement");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCustomers();
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      type: "individual",
      name: "",
      email: "",
      phone: "",
      street_name: "",
      building_number: "",
      postal_code: "",
      city: "",
      country: "BE",
      country_subdivision: "",
      vat_number: "",
      company_id: "",
      peppol_id: "",
      endpoint_id: "",
      receive_invoices_by_peppol: false,
      payment_terms_days: 30,
      language: "fr",
      bank_account_iban: "",
      bank_account_bic: "",
      bank_account_name: "",
      contact_name: "",
      notes: ""
    });
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      type: customer.type || "individual",
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      street_name: customer.street_name || customer.address || "",
      building_number: customer.building_number || "",
      postal_code: customer.postal_code || "",
      city: customer.city || "",
      country: customer.country || "BE",
      country_subdivision: customer.country_subdivision || "",
      vat_number: customer.vat_number || "",
      company_id: customer.company_id || "",
      peppol_id: customer.peppol_id || "",
      endpoint_id: customer.endpoint_id || "",
      receive_invoices_by_peppol: customer.receive_invoices_by_peppol || false,
      payment_terms_days: customer.payment_terms_days || 30,
      language: customer.language || "fr",
      bank_account_iban: customer.bank_account_iban || "",
      bank_account_bic: customer.bank_account_bic || "",
      bank_account_name: customer.bank_account_name || "",
      contact_name: customer.contact_name || "",
      notes: customer.notes || ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await axios.put(`${API}/customers/${editingCustomer.id}`, formData);
        toast.success("Client modifié");
      } else {
        await axios.post(`${API}/customers`, formData);
        toast.success("Client créé");
      }
      
      setShowModal(false);
      fetchCustomers();
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    }
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm("Supprimer ce client ?")) return;
    
    try {
      await axios.delete(`${API}/customers/${customerId}`);
      toast.success("Client supprimé");
      fetchCustomers();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (typeFilter !== "all" && customer.type !== typeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(q) ||
      customer.email?.toLowerCase().includes(q) ||
      customer.phone?.toLowerCase().includes(q) ||
      customer.vat_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6" data-testid="clients">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy">
            Clients / Klanten
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos clients particuliers et professionnels
          </p>
        </div>
        <Button className="bg-brand-orange hover:bg-brand-orange/90" onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau client
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nom, email, téléphone, TVA..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-clients"
              />
            </div>
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="individual">Particulier</SelectItem>
              <SelectItem value="company">Entreprise</SelectItem>
            </SelectContent>
          </Select>

          <Button type="submit" variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
          </Button>

          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </form>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-medium text-sm">Client</th>
                <th className="text-left p-4 font-medium text-sm">Type</th>
                <th className="text-left p-4 font-medium text-sm">Contact</th>
                <th className="text-left p-4 font-medium text-sm">Adresse</th>
                <th className="text-right p-4 font-medium text-sm">Solde</th>
                <th className="text-right p-4 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`customer-row-${customer.id}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {customer.type === "company" ? (
                          <Building2 className="w-5 h-5 text-brand-navy" />
                        ) : (
                          <User className="w-5 h-5 text-brand-navy" />
                        )}
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          {customer.vat_number && (
                            <p className="text-xs text-muted-foreground">TVA: {customer.vat_number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {customer.type === "individual" ? "Particulier" : "Entreprise"}
                        </Badge>
                        {customer.receive_invoices_by_peppol && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            <FileCheck className="w-3 h-3 mr-1" />
                            Peppol
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {customer.street_name || customer.address ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3 h-3 mt-1" />
                          <span>
                            {customer.street_name || customer.address}
                            {customer.building_number && ` ${customer.building_number}`}
                            , {customer.postal_code} {customer.city}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-bold ${customer.balance < 0 ? "text-red-600" : "text-green-600"}`}>
                        €{Math.abs(customer.balance).toFixed(2)}
                      </span>
                      {customer.balance < 0 && (
                        <p className="text-xs text-red-600">À payer</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Historique" onClick={() => navigate(`/customers/${customer.id}/history`)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Modifier" onClick={() => openEditModal(customer)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Supprimer" className="text-red-500" onClick={() => handleDelete(customer.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200">
          <p className="text-sm text-muted-foreground">
            {filteredCustomers.length} client(s)
          </p>
        </div>
      </div>

      {/* Customer Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Modifier le client" : "Nouveau client"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer ? "Modifiez les informations du client" : "Créez un nouveau client (particulier ou professionnel)"}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">
                  <User className="w-4 h-4 mr-2" />
                  Général
                </TabsTrigger>
                <TabsTrigger value="address">
                  <MapPin className="w-4 h-4 mr-2" />
                  Adresse
                </TabsTrigger>
                <TabsTrigger value="billing">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Facturation
                </TabsTrigger>
                <TabsTrigger value="peppol">
                  <FileCheck className="w-4 h-4 mr-2" />
                  Peppol
                </TabsTrigger>
              </TabsList>

              {/* Onglet Général */}
              <TabsContent value="general" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="type">Type de client *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Particulier</SelectItem>
                      <SelectItem value="company">Professionnel / Entreprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="name">Nom {formData.type === "company" ? "de l'entreprise" : "du client"} *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                {formData.type === "company" && (
                  <div>
                    <Label htmlFor="contact_name">Personne de contact</Label>
                    <Input
                      id="contact_name"
                      placeholder="Nom du contact principal"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="language">Langue de communication</Label>
                  <Select value={formData.language} onValueChange={(value) => setFormData({...formData, language: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="nl">Nederlands</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <textarea
                    id="notes"
                    className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
              </TabsContent>

              {/* Onglet Adresse */}
              <TabsContent value="address" className="space-y-4 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <Globe className="w-4 h-4 inline mr-2" />
                  L'adresse structurée est requise pour les factures électroniques Peppol.
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="street_name">Rue</Label>
                    <Input
                      id="street_name"
                      placeholder="Rue de la Loi"
                      value={formData.street_name}
                      onChange={(e) => setFormData({...formData, street_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="building_number">Numéro</Label>
                    <Input
                      id="building_number"
                      placeholder="123"
                      value={formData.building_number}
                      onChange={(e) => setFormData({...formData, building_number: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="postal_code">Code postal</Label>
                    <Input
                      id="postal_code"
                      placeholder="1000"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      placeholder="Bruxelles"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country_subdivision">Province / Région</Label>
                    <Input
                      id="country_subdivision"
                      placeholder="Bruxelles-Capitale"
                      value={formData.country_subdivision}
                      onChange={(e) => setFormData({...formData, country_subdivision: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Pays</Label>
                    <Select value={formData.country} onValueChange={(value) => setFormData({...formData, country: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BE">Belgique / België</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="NL">Pays-Bas / Nederland</SelectItem>
                        <SelectItem value="DE">Allemagne / Duitsland</SelectItem>
                        <SelectItem value="LU">Luxembourg</SelectItem>
                        <SelectItem value="GB">Royaume-Uni</SelectItem>
                        <SelectItem value="ES">Espagne</SelectItem>
                        <SelectItem value="IT">Italie</SelectItem>
                        <SelectItem value="AT">Autriche</SelectItem>
                        <SelectItem value="CH">Suisse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Onglet Facturation */}
              <TabsContent value="billing" className="space-y-4 mt-4">
                {formData.type === "company" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vat_number">Numéro TVA</Label>
                        <Input
                          id="vat_number"
                          placeholder="BE0123456789"
                          value={formData.vat_number}
                          onChange={(e) => setFormData({...formData, vat_number: e.target.value})}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Format: BEXXXXXXXXXX</p>
                      </div>
                      <div>
                        <Label htmlFor="company_id">Numéro BCE / KBO</Label>
                        <Input
                          id="company_id"
                          placeholder="0123.456.789"
                          value={formData.company_id}
                          onChange={(e) => setFormData({...formData, company_id: e.target.value})}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Banque-Carrefour des Entreprises</p>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="payment_terms_days">Délai de paiement (jours)</Label>
                  <Input
                    id="payment_terms_days"
                    type="number"
                    min="0"
                    max="365"
                    value={formData.payment_terms_days}
                    onChange={(e) => setFormData({...formData, payment_terms_days: parseInt(e.target.value) || 30})}
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3">Coordonnées bancaires du client</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Optionnel - Pour les remboursements et virements
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="bank_account_iban">IBAN</Label>
                      <Input
                        id="bank_account_iban"
                        placeholder="BE68 5390 0754 7034"
                        value={formData.bank_account_iban}
                        onChange={(e) => setFormData({...formData, bank_account_iban: e.target.value.toUpperCase()})}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bank_account_bic">BIC / SWIFT</Label>
                        <Input
                          id="bank_account_bic"
                          placeholder="BBRUBEBB"
                          value={formData.bank_account_bic}
                          onChange={(e) => setFormData({...formData, bank_account_bic: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bank_account_name">Titulaire du compte</Label>
                        <Input
                          id="bank_account_name"
                          placeholder="Nom sur le compte"
                          value={formData.bank_account_name}
                          onChange={(e) => setFormData({...formData, bank_account_name: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Onglet Peppol */}
              <TabsContent value="peppol" className="space-y-4 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    <FileCheck className="w-4 h-4 inline mr-2" />
                    Facturation électronique Peppol
                  </h4>
                  <p className="text-sm text-blue-800">
                    Peppol permet l'envoi de factures électroniques structurées (UBL) directement 
                    dans le système comptable du client. Obligatoire pour les administrations publiques en Belgique.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="receive_invoices_by_peppol" className="font-medium">
                      Ce client reçoit ses factures via Peppol
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Les factures seront envoyées automatiquement via le réseau Peppol
                    </p>
                  </div>
                  <Switch
                    id="receive_invoices_by_peppol"
                    checked={formData.receive_invoices_by_peppol}
                    onCheckedChange={(checked) => setFormData({...formData, receive_invoices_by_peppol: checked})}
                  />
                </div>

                {formData.receive_invoices_by_peppol && (
                  <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                    <div>
                      <Label htmlFor="peppol_id">Peppol ID du client</Label>
                      <Input
                        id="peppol_id"
                        placeholder="0208:0123456789"
                        value={formData.peppol_id}
                        onChange={(e) => setFormData({...formData, peppol_id: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: 0208:NuméroTVA (Belgique) ou autre schéma Peppol
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="endpoint_id">Endpoint ID (GLN/DUNS si différent)</Label>
                      <Input
                        id="endpoint_id"
                        placeholder="Optionnel - Si différent du Peppol ID"
                        value={formData.endpoint_id}
                        onChange={(e) => setFormData({...formData, endpoint_id: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Utilisé si le client a un identifiant de réception différent
                      </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                      <p className="font-medium text-amber-800">💡 Où trouver le Peppol ID ?</p>
                      <ul className="mt-2 text-amber-700 space-y-1">
                        <li>• Demandez-le directement au client</li>
                        <li>• Vérifiez sur <a href="https://directory.peppol.eu" target="_blank" rel="noreferrer" className="underline">directory.peppol.eu</a></li>
                        <li>• Pour les entreprises belges: 0208: + numéro TVA sans BE</li>
                      </ul>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-brand-orange hover:bg-brand-orange/90">
                {editingCustomer ? "Sauvegarder" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
