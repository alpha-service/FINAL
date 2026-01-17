import { LayoutGrid, Maximize2, Columns, PanelTop, Maximize, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LAYOUT_PRESETS, PRESET_CONFIG } from '@/hooks/usePOSLayout';

const iconMap = {
  LayoutGrid,
  Maximize2,
  Columns,
  PanelTop,
  Maximize
};

export default function LayoutSelector({ currentPreset, onSelectPreset }) {
  const currentConfig = PRESET_CONFIG[currentPreset] || PRESET_CONFIG[LAYOUT_PRESETS.CLASSIC];
  const CurrentIcon = iconMap[currentConfig?.icon] || LayoutGrid;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          title="Changer le layout / Layout wijzigen"
        >
          <CurrentIcon className="w-4 h-4" />
          <span className="hidden md:inline">{currentConfig.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel>Layouts / Indelingen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(LAYOUT_PRESETS).map(([key, presetId]) => {
          const config = PRESET_CONFIG[presetId];
          const Icon = iconMap[config.icon];
          const isActive = currentPreset === presetId;
          
          return (
            <DropdownMenuItem
              key={presetId}
              onClick={() => onSelectPreset(presetId)}
              className="flex items-start gap-3 py-3 cursor-pointer"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-orange' : 'text-slate-600'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{config.name}</span>
                  {isActive && <Check className="w-4 h-4 text-brand-orange" />}
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-xs text-muted-foreground">
          💡 Astuce: Redimensionnez avec la souris
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
