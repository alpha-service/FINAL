import { useDesign, DESIGNS, DESIGN_CONFIG } from "@/hooks/useDesign";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette, Check, Layout, Layers, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const DESIGN_ICONS = {
  [DESIGNS.CLASSIC]: Layout,
  [DESIGNS.MODERN]: Layers,
  [DESIGNS.MINIMAL]: Minus
};

const DESIGN_PREVIEWS = {
  [DESIGNS.CLASSIC]: {
    colors: ['#1e3a8a', '#ff6b35', '#f1f5f9'],
    style: 'Traditional'
  },
  [DESIGNS.MODERN]: {
    colors: ['#8b5cf6', '#ec4899', '#06b6d4'],
    style: 'Glassmorphism'
  },
  [DESIGNS.MINIMAL]: {
    colors: ['#000000', '#737373', '#ffffff'],
    style: 'Flat'
  }
};

export default function DesignSelector({ variant = "ghost", size = "icon", showLabel = false }) {
  const { currentDesign, changeDesign, design } = useDesign();
  const Icon = DESIGN_ICONS[currentDesign] || Layout;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={cn(
            size === "icon" ? "h-8 w-8" : "",
            "text-white hover:bg-white/10"
          )}
          title="Changer le design / Verander ontwerp"
        >
          <Icon className="w-4 h-4" />
          {showLabel && <span className="ml-2 text-sm">Design</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Interface Design / Ontwerp
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(DESIGN_CONFIG).map(([designId, config]) => {
          const DesignIcon = DESIGN_ICONS[designId];
          const preview = DESIGN_PREVIEWS[designId];
          const isActive = currentDesign === designId;
          
          return (
            <DropdownMenuItem
              key={designId}
              onClick={() => changeDesign(designId)}
              className={cn(
                "flex items-center gap-3 py-3 cursor-pointer",
                isActive && "bg-slate-100"
              )}
            >
              <div className="flex-shrink-0">
                <DesignIcon className={cn(
                  "w-5 h-5",
                  isActive ? "text-brand-orange" : "text-slate-500"
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium text-sm",
                    isActive && "text-brand-navy"
                  )}>
                    {config.name}
                  </span>
                  {isActive && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {config.description}
                </p>
                
                {/* Color preview */}
                <div className="flex gap-1 mt-1.5">
                  {preview.colors.map((color, idx) => (
                    <div
                      key={idx}
                      className="w-4 h-4 rounded-full border border-slate-200"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className="text-[10px] text-slate-400 ml-1">
                    {preview.style}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
          Design affecte toute l'interface
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
