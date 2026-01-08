import { useState, useEffect } from "react";
import axios from "axios";
import { Search, User, Building2, Phone, Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CustomerSelect({ open, onClose, onSelect }) {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCustomers();
    }
  }, [open]);

  const fetchCustomers = async (search = "") => {
    setLoading(true);
    try {
      const params = search ? { search } : {};
      const response = await axios.get(`${API}/customers`, { params });
      setCustomers(response.data);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    fetchCustomers(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" data-testid="customer-select-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Sélectionner client / Klant selecteren
          </DialogTitle>
          <DialogDescription>
            Rechercher par nom, téléphone ou TVA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher... / Zoeken..."
              className="pl-10 h-11"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              data-testid="customer-search"
            />
          </div>

          {/* Customer List */}
          <ScrollArea className="h-80">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-3 border-brand-navy border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <User className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucun client trouvé / Geen klanten gevonden</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-brand-navy/50 hover:bg-slate-50 transition-colors"
                    onClick={() => onSelect(customer)}
                    data-testid={`customer-${customer.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          customer.type === "company" 
                            ? "bg-blue-100 text-blue-600" 
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {customer.type === "company" ? (
                            <Building2 className="w-5 h-5" />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {customer.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {customer.phone}
                              </span>
                            )}
                            {customer.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {customer.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={customer.type === "company" ? "default" : "secondary"}>
                        {customer.type === "company" ? customer.vat_number : "Particulier"}
                      </Badge>
                    </div>
                    {customer.credit_limit > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Limite crédit / Kredietlimiet: €{customer.credit_limit.toFixed(2)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <Button variant="outline" className="w-full" onClick={onClose}>
          Annuler / Annuleren
        </Button>
      </DialogContent>
    </Dialog>
  );
}
