import { useState, useEffect } from "react";
import axios from "axios";
import {
  Settings as SettingsIcon,
  Printer,
  Barcode,
  Globe,
  Building2,
  Bell,
  Shield,
  Database,
  ShoppingBag,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Save,
  CreditCard,
  FileText,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  
  // Company Settings
  const [companySettings, setCompanySettings] = useState({
    company_name: "",
    legal_name: "",
    company_id: "",
    vat_number: "",
    peppol_id: "",
    street_name: "",
    building_number: "",
    address_line: "",
    city: "",
    postal_code: "",
    country: "BE",
    phone: "",
    email: "",
    website: "",
    bank_account_iban: "",
    bank_account_bic: "",
    bank_name: "",
    default_payment_terms_days: 30,
    invoice_footer_text: "",
    quote_footer_text: ""
  });
  const [companyLoading, setCompanyLoading] = useState(true);
  
  // Peppyrus/Peppol Settings
  const [peppyrusSettings, setPeppyrusSettings] = useState({
    enabled: false,
    api_key: "",
    api_secret: "",
    api_url: "https://api.peppyrus.be",
    sender_id: "",
    test_mode: true,
    auto_send_invoices: false
  });
  const [peppyrusLoading, setPeppyrusLoading] = useState(true);
  const [peppolTestResult, setPeppolTestResult] = useState(null);
  
  // Shopify state
  const [shopifySettings, setShopifySettings] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState([]);
  const [unmappedProducts, setUnmappedProducts] = useState([]);
  const [showSyncLogs, setShowSyncLogs] = useState(false);

  useEffect(() => {
    loadCompanySettings();
    loadPeppyrusSettings();
    loadShopifySettings();
    loadSyncLogs();
    loadUnmappedProducts();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const response = await axios.get(`${API}/company-settings`);
      if (response.data) {
        setCompanySettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error("Error loading company settings:", error);
    } finally {
      setCompanyLoading(false);
    }
  };

  const saveCompanySettings = async () => {
    try {
      await axios.post(`${API}/company-settings`, companySettings);
      toast.success("Paramètres entreprise sauvegardés");
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const loadPeppyrusSettings = async () => {
    try {
      const response = await axios.get(`${API}/peppyrus/settings`);
      if (response.data) {
        setPeppyrusSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error("Error loading Peppyrus settings:", error);
    } finally {
      setPeppyrusLoading(false);
    }
  };

  const savePeppyrusSettings = async () => {
    try {
      await axios.post(`${API}/peppyrus/settings`, peppyrusSettings);
      toast.success("Paramètres Peppol sauvegardés");
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const testPeppolConnection = async () => {
    setPeppolTestResult({ status: "testing" });
    try {
      const response = await axios.post(`${API}/peppyrus/test-connection`);
      setPeppolTestResult(response.data);
      if (response.data.status === "connected") {
        toast.success("Connexion Peppol réussie!");
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      setPeppolTestResult({ status: "error", message: "Erreur de connexion" });
      toast.error("Erreur lors du test");
    }
  };

  const loadShopifySettings = async () => {
    try {
      const response = await axios.get(`${API}/shopify/settings`);
      setShopifySettings(response.data);
    } catch (error) {
      console.error("Error loading Shopify settings:", error);
    } finally {
      setShopifyLoading(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const response = await axios.get(`${API}/shopify/sync-logs?limit=10`);
      setSyncLogs(response.data);
    } catch (error) {
      console.error("Error loading sync logs:", error);
    }
  };

  const loadUnmappedProducts = async () => {
    try {
      const response = await axios.get(`${API}/shopify/unmapped-products`);
      setUnmappedProducts(response.data);
    } catch (error) {
      console.error("Error loading unmapped products:", error);
    }
  };

  const handleShopifySettingsChange = (field, value) => {
    setShopifySettings(prev => ({ ...prev, [field]: value }));
  };

  const saveShopifySettings = async () => {
    try {
      await axios.post(`${API}/shopify/settings`, shopifySettings);
      toast.success("Paramètres Shopify sauvegardés");
      loadShopifySettings();
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleSyncProducts = async () => {
    toast.info("Synchronisation des produits...");
    try {
      await axios.post(`${API}/shopify/sync/products`);
      toast.success("Produits importés avec succès");
      loadSyncLogs();
      loadUnmappedProducts();
    } catch (error) {
      toast.error("Erreur lors de l'import");
    }
  };

  const handleSyncStock = async () => {
    toast.info("Synchronisation du stock...");
    try {
      const response = await axios.post(`${API}/shopify/sync/stock`);
      toast.success(`Stock synchronisé: ${response.data.items_synced} produits`);
      loadSyncLogs();
    } catch (error) {
      toast.error("Erreur lors de la synchro stock");
    }
  };

  const handleSyncOrders = async () => {
    toast.info("Import des commandes...");
    try {
      await axios.post(`${API}/shopify/sync/orders`);
      toast.success("Commandes importées");
      loadSyncLogs();
    } catch (error) {
      toast.error("Erreur lors de l'import");
    }
  };

  const handleSave = () => {
    toast.success("Paramètres sauvegardés");
  };

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case "success": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-600" />;
      case "pending": return <Clock className="w-4 h-4 text-amber-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="p-6" data-testid="settings">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-brand-navy">
          Paramètres / Instellingen
        </h1>
        <p className="text-muted-foreground mt-1">
          Configuration du système POS
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Entreprise</span>
          </TabsTrigger>
          <TabsTrigger value="peppol" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Peppol</span>
          </TabsTrigger>
          <TabsTrigger value="shopify" className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Shopify</span>
          </TabsTrigger>
          <TabsTrigger value="hardware" className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Matériel</span>
          </TabsTrigger>
        </TabsList>

        {/* Company Settings Tab */}
        <TabsContent value="company">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Identity */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Identité entreprise</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nom commercial</label>
                  <Input 
                    value={companySettings.company_name}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="ALPHA&CO BVBA"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Raison sociale (légale)</label>
                  <Input 
                    value={companySettings.legal_name || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, legal_name: e.target.value }))}
                    placeholder="ALPHA&CO BOUWMATERIALEN & DESIGN BVBA"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">N° BCE/KBO</label>
                    <Input 
                      value={companySettings.company_id || ""}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, company_id: e.target.value }))}
                      placeholder="0123.456.789"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">N° TVA</label>
                    <Input 
                      value={companySettings.vat_number || ""}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, vat_number: e.target.value }))}
                      placeholder="BE0123456789"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Peppol ID</label>
                  <Input 
                    value={companySettings.peppol_id || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, peppol_id: e.target.value }))}
                    placeholder="0208:BE0123456789"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Format: 0208:BE + numéro TVA sans espaces</p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Adresse</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Rue</label>
                    <Input 
                      value={companySettings.street_name || ""}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, street_name: e.target.value }))}
                      placeholder="Ninoofsesteenweg"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">N°</label>
                    <Input 
                      value={companySettings.building_number || ""}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, building_number: e.target.value }))}
                      placeholder="77-79"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Code postal</label>
                    <Input 
                      value={companySettings.postal_code || ""}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, postal_code: e.target.value }))}
                      placeholder="1700"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Ville</label>
                    <Input 
                      value={companySettings.city || ""}
                      onChange={(e) => setCompanySettings(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Dilbeek"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Pays</label>
                  <Input 
                    value={companySettings.country || "BE"}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="BE"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Contact</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Téléphone</label>
                  <Input 
                    value={companySettings.phone || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+32 2 123 45 67"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <Input 
                    value={companySettings.email || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="info@alpha-co.be"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Site web</label>
                  <Input 
                    value={companySettings.website || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://www.alpha-co.be"
                  />
                </div>
              </div>
            </div>

            {/* Bank Account */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Coordonnées bancaires</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">IBAN</label>
                  <Input 
                    value={companySettings.bank_account_iban || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, bank_account_iban: e.target.value }))}
                    placeholder="BE68 5390 0754 7034"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">BIC/SWIFT</label>
                  <Input 
                    value={companySettings.bank_account_bic || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, bank_account_bic: e.target.value }))}
                    placeholder="TRIOBEBBXXX"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Nom de la banque</label>
                  <Input 
                    value={companySettings.bank_name || ""}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Belfius"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Délai de paiement par défaut (jours)</label>
                  <Input 
                    type="number"
                    value={companySettings.default_payment_terms_days || 30}
                    onChange={(e) => setCompanySettings(prev => ({ ...prev, default_payment_terms_days: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button onClick={saveCompanySettings} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Sauvegarder les paramètres
            </Button>
          </div>
        </TabsContent>

        {/* Peppol/Peppyrus Settings Tab */}
        <TabsContent value="peppol">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peppyrus API */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Peppyrus API (Peppol Belgique)</h2>
              </div>
              
              <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Activer Peppol</p>
                  <p className="text-sm text-muted-foreground">Envoi automatique des factures via Peppol</p>
                </div>
                <Switch 
                  checked={peppyrusSettings.enabled}
                  onCheckedChange={(checked) => setPeppyrusSettings(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">URL API Peppyrus</label>
                  <Input 
                    value={peppyrusSettings.api_url}
                    onChange={(e) => setPeppyrusSettings(prev => ({ ...prev, api_url: e.target.value }))}
                    placeholder="https://api.peppyrus.be"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Clé API</label>
                  <Input 
                    value={peppyrusSettings.api_key || ""}
                    onChange={(e) => setPeppyrusSettings(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="pk_live_..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Secret API</label>
                  <Input 
                    type="password"
                    value={peppyrusSettings.api_secret || ""}
                    onChange={(e) => setPeppyrusSettings(prev => ({ ...prev, api_secret: e.target.value }))}
                    placeholder="sk_live_..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Sender ID (Peppol)</label>
                  <Input 
                    value={peppyrusSettings.sender_id || ""}
                    onChange={(e) => setPeppyrusSettings(prev => ({ ...prev, sender_id: e.target.value }))}
                    placeholder="0208:BE0123456789"
                  />
                </div>
              </div>
            </div>

            {/* Peppol Options */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Send className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Options d'envoi</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">Mode test (Sandbox)</p>
                    <p className="text-sm text-muted-foreground">Utiliser l'environnement de test</p>
                  </div>
                  <Switch 
                    checked={peppyrusSettings.test_mode}
                    onCheckedChange={(checked) => setPeppyrusSettings(prev => ({ ...prev, test_mode: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">Envoi automatique</p>
                    <p className="text-sm text-muted-foreground">Envoyer automatiquement les factures après création</p>
                  </div>
                  <Switch 
                    checked={peppyrusSettings.auto_send_invoices}
                    onCheckedChange={(checked) => setPeppyrusSettings(prev => ({ ...prev, auto_send_invoices: checked }))}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    onClick={testPeppolConnection}
                    className="w-full"
                    disabled={!peppyrusSettings.api_key}
                  >
                    {peppolTestResult?.status === "testing" ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Tester la connexion
                  </Button>

                  {peppolTestResult && peppolTestResult.status !== "testing" && (
                    <div className={`p-3 rounded-lg text-sm ${
                      peppolTestResult.status === "connected" 
                        ? "bg-green-50 text-green-800 border border-green-200" 
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}>
                      {peppolTestResult.status === "connected" ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Connexion réussie à Peppyrus!
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          {peppolTestResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">📋 Prérequis Peppol Belgique</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Numéro BCE/KBO valide</li>
                    <li>Numéro TVA belge actif</li>
                    <li>Compte Peppyrus ou autre Access Point</li>
                    <li>Format facture: UBL 2.1 / Peppol BIS 3.0</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={savePeppyrusSettings} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Sauvegarder configuration Peppol
            </Button>
          </div>
        </TabsContent>

        {/* Shopify Tab */}
        <TabsContent value="shopify">
          <div className="grid grid-cols-1 gap-6">
        {/* Shopify Integration */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-brand-navy" />
              <h2 className="font-heading font-bold">Shopify Integration</h2>
            </div>
            {shopifySettings && (
              <Badge className={shopifySettings.auto_sync_enabled ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}>
                {shopifySettings.auto_sync_enabled ? "Sync Auto" : "Sync Manuel"}
              </Badge>
            )}
          </div>

          {shopifyLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : (
            <div className="space-y-6">
              {/* Connection Settings */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Store Domain</label>
                  <Input 
                    placeholder="yourstore.myshopify.com"
                    value={shopifySettings?.store_domain || ""}
                    onChange={(e) => handleShopifySettingsChange("store_domain", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Access Token (Admin API)</label>
                  <Input 
                    type="password"
                    placeholder="shpat_..."
                    value={shopifySettings?.access_token || ""}
                    onChange={(e) => handleShopifySettingsChange("access_token", e.target.value)}
                  />
                </div>
                <Button onClick={saveShopifySettings} variant="outline" size="sm">
                  Sauvegarder la configuration
                </Button>
              </div>

              <Separator />

              {/* Sync Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Import Produits</p>
                    <p className="text-sm text-muted-foreground">Importer produits depuis Shopify vers POS</p>
                  </div>
                  <Switch 
                    checked={shopifySettings?.import_products_enabled || false}
                    onCheckedChange={(checked) => {
                      handleShopifySettingsChange("import_products_enabled", checked);
                      saveShopifySettings();
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Export Stock</p>
                    <p className="text-sm text-muted-foreground">Pousser les stocks POS vers Shopify</p>
                  </div>
                  <Switch 
                    checked={shopifySettings?.export_stock_enabled || false}
                    onCheckedChange={(checked) => {
                      handleShopifySettingsChange("export_stock_enabled", checked);
                      saveShopifySettings();
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Import Commandes</p>
                    <p className="text-sm text-muted-foreground">Importer commandes Shopify comme ventes</p>
                  </div>
                  <Switch 
                    checked={shopifySettings?.import_orders_enabled || false}
                    onCheckedChange={(checked) => {
                      handleShopifySettingsChange("import_orders_enabled", checked);
                      saveShopifySettings();
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Synchronisation automatique</p>
                    <p className="text-sm text-muted-foreground">
                      Sync tous les {shopifySettings?.sync_interval_minutes || 10} minutes
                    </p>
                  </div>
                  <Switch 
                    checked={shopifySettings?.auto_sync_enabled || false}
                    onCheckedChange={(checked) => {
                      handleShopifySettingsChange("auto_sync_enabled", checked);
                      saveShopifySettings();
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* Import Info Card */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">📦 Données importées de Shopify</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                  <div>• SKU / Code produit</div>
                  <div>• Barcode / EAN / GTIN</div>
                  <div>• Prix de vente</div>
                  <div>• Prix comparé (barré)</div>
                  <div>• Stock disponible</div>
                  <div>• Poids et unité</div>
                  <div>• Fournisseur / Vendor</div>
                  <div>• Tags produit</div>
                  <div>• Type de produit</div>
                  <div>• Images produit</div>
                </div>
              </div>

              {/* Manual Sync Actions */}
              <div>
                <h3 className="font-medium mb-3">Actions manuelles</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={handleSyncProducts}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Import Produits
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={handleSyncStock}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Push Stock
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={handleSyncOrders}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Import Commandes
                  </Button>
                </div>
              </div>

              {/* Last Sync Info */}
              {shopifySettings && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-medium text-sm mb-2">Dernières synchronisations</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Produits:</span>
                      <span>{shopifySettings.last_product_sync ? new Date(shopifySettings.last_product_sync).toLocaleString("fr-BE") : "Jamais"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stock:</span>
                      <span>{shopifySettings.last_stock_sync ? new Date(shopifySettings.last_stock_sync).toLocaleString("fr-BE") : "Jamais"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Commandes:</span>
                      <span>{shopifySettings.last_order_sync ? new Date(shopifySettings.last_order_sync).toLocaleString("fr-BE") : "Jamais"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Unmapped Products Alert */}
              {unmappedProducts.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{unmappedProducts.length} produits non mappés</p>
                      <p className="text-sm">Ces produits Shopify n'ont pas pu être automatiquement importés (SKU/code-barres manquant ou dupliqué)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sync Logs Toggle */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowSyncLogs(!showSyncLogs)}
                className="w-full"
              >
                {showSyncLogs ? "Masquer" : "Afficher"} les logs de synchronisation ({syncLogs.length})
              </Button>

              {/* Sync Logs */}
              {showSyncLogs && syncLogs.length > 0 && (
                <div className="space-y-2">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {getSyncStatusIcon(log.status)}
                          <span className="font-medium">{log.sync_type}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("fr-BE")}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {log.items_processed > 0 ? (
                          <span>{log.items_processed} traités • {log.items_succeeded} réussis • {log.items_failed} échecs</span>
                        ) : (
                          <span>{log.details?.message || "En attente"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
          </div>
        </TabsContent>

        {/* Hardware Tab */}
        <TabsContent value="hardware">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receipt Printer */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Printer className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Imprimante tickets</h2>
              </div>
              
              <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Activer ESC/POS</p>
                  <p className="text-sm text-muted-foreground">Impression thermique USB/Réseau</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Non configuré
                  </Badge>
                  <Switch checked={printerEnabled} onCheckedChange={setPrinterEnabled} />
                </div>
              </div>

              {printerEnabled && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>Module ESC/POS:</strong> Non implémenté dans cette version.
                    <br />
                    Utilise actuellement l'impression navigateur (window.print).
                  </p>
                  <div className="mt-3 space-y-2">
                    <Input placeholder="Adresse IP ou port USB" disabled />
                    <Button variant="outline" size="sm" disabled>Tester connexion</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Barcode Scanner */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Barcode className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Scanner code-barres</h2>
              </div>
              
              <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Mode clavier HID</p>
                  <p className="text-sm text-muted-foreground">Scanner USB Approx</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">Actif</Badge>
                  <Switch checked={scannerEnabled} onCheckedChange={setScannerEnabled} />
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 mb-2">
                  <strong>✓ Scanner configuré:</strong> Mode clavier activé
                </p>
                <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                  <li>Supporte EAN-13, EAN-8, UPC-A, Code128</li>
                  <li>Détection automatique Enter suffix</li>
                  <li>Ajout automatique au panier depuis POS</li>
                  <li>Recherche par SKU, barcode ou GTIN</li>
                </ul>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-brand-navy" />
                <h2 className="font-heading font-bold">Système</h2>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Version</p>
                  <p className="font-mono font-bold">2.1.0</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Base de données</p>
                  <Badge className="bg-green-100 text-green-800">Connecté</Badge>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Backend API</p>
                  <Badge className="bg-green-100 text-green-800">En ligne</Badge>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Format numérotation</p>
                  <p className="font-mono">YYMMDD-XXX</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <h3 className="font-medium text-sm mb-3">Préfixes documents</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span>Devis</span>
                    <span className="font-mono font-bold">DV</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span>Facture</span>
                    <span className="font-mono font-bold">FA</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span>Ticket</span>
                    <span className="font-mono font-bold">RC</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded border">
                    <span>Avoir</span>
                    <span className="font-mono font-bold">CN</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
