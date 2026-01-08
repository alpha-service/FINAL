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
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [peppolEnabled, setPeppolEnabled] = useState(false);

  const handleSave = () => {
    toast.success("Paramètres sauvegardés");
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Informations entreprise</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nom</label>
              <Input value="ALPHA&CO BOUWMATERIALEN & DESIGN" disabled />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Adresse</label>
              <Input value="Ninoofsesteenweg 77-79, 1700 Dilbeek" disabled />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">TVA</label>
              <Input value="BE 1028.386.674" disabled />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Téléphone</label>
              <Input value="+32 (0)2/1111/111" disabled />
            </div>
          </div>
        </div>

        {/* Hardware Integrations */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Printer className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Matériel / Hardware</h2>
          </div>
          
          <div className="space-y-6">
            {/* Receipt Printer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Printer className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-medium">Imprimante tickets</p>
                  <p className="text-sm text-muted-foreground">ESC/POS USB/Réseau</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Non configuré
                </Badge>
                <Switch checked={printerEnabled} onCheckedChange={setPrinterEnabled} />
              </div>
            </div>

            {printerEnabled && (
              <div className="ml-13 p-4 bg-amber-50 rounded-lg border border-amber-200">
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

            <Separator />

            {/* Barcode Scanner */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Barcode className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-medium">Scanner code-barres</p>
                  <p className="text-sm text-muted-foreground">Mode clavier (HID)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800">Actif</Badge>
                <Switch checked={scannerEnabled} onCheckedChange={setScannerEnabled} />
              </div>
            </div>

            {scannerEnabled && (
              <div className="ml-13 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Mode clavier activé:</strong> Le scanner fonctionne comme un clavier.
                  <br />
                  Scannez un code-barres dans le champ de recherche pour ajouter automatiquement le produit au panier.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Peppol / E-Invoicing */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">E-facturation / Peppol</h2>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-medium">Peppol E-Invoicing</p>
                <p className="text-sm text-muted-foreground">Format UBL XML</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Non configuré
              </Badge>
              <Switch checked={peppolEnabled} onCheckedChange={setPeppolEnabled} />
            </div>
          </div>

          {peppolEnabled && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 mb-3">
                <strong>Module Peppol:</strong> Interface préparée, envoi non implémenté.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Peppol ID (Participant)</label>
                  <Input placeholder="0208:BE1028386674" disabled />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Access Point URL</label>
                  <Input placeholder="https://ap.peppol.eu/..." disabled />
                </div>
                <Button variant="outline" size="sm" disabled>Vérifier configuration</Button>
              </div>
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-brand-navy" />
            <h2 className="font-heading font-bold">Système</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">2.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-muted-foreground">Base de données</span>
              <Badge className="bg-green-100 text-green-800">Connecté</Badge>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-muted-foreground">Backend API</span>
              <Badge className="bg-green-100 text-green-800">En ligne</Badge>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Format numérotation</span>
              <span className="font-mono">YYMMDD-XXX</span>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <h3 className="font-medium text-sm">Préfixes documents</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span>Devis</span>
                <span className="font-mono">DV</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span>Facture</span>
                <span className="font-mono">FA</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span>Ticket</span>
                <span className="font-mono">RC</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded">
                <span>Avoir</span>
                <span className="font-mono">CN</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} className="bg-brand-navy hover:bg-brand-navy/90">
          Sauvegarder les paramètres
        </Button>
      </div>
    </div>
  );
}
