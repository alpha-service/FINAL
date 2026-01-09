import { LayoutGrid, Maximize2, LayoutPanelTop, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LAYOUT_ICONS = {
  split_classic: LayoutGrid,
  cart_focus: Maximize2,
  bottom_drawer: LayoutPanelTop,
  full_table: Table
};

export default function LayoutSwitcher({ currentPreset, setPreset, presetConfig }) {
  const CurrentIcon = LAYOUT_ICONS[currentPreset] || LayoutGrid;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CurrentIcon className="w-4 h-4" />
          <span className="hidden md:inline">{presetConfig.name}</span>
          <span className="text-xs text-slate-500">(F6)</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mise en page</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => setPreset('split_classic')}
          className={currentPreset === 'split_classic' ? 'bg-slate-100' : ''}
        >
          <LayoutGrid className="w-4 h-4 mr-2" />
          <div>
            <div className="font-medium">Classic Split</div>
            <div className="text-xs text-slate-500">Catalogue + Panier redimensionnable</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setPreset('cart_focus')}
          className={currentPreset === 'cart_focus' ? 'bg-slate-100' : ''}
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          <div>
            <div className="font-medium">Cart Focus</div>
            <div className="text-xs text-slate-500">Panier plus large (550-700px)</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setPreset('bottom_drawer')}
          className={currentPreset === 'bottom_drawer' ? 'bg-slate-100' : ''}
        >
          <LayoutPanelTop className="w-4 h-4 mr-2" />
          <div>
            <div className="font-medium">Bottom Drawer</div>
            <div className="text-xs text-slate-500">Barre en bas + tiroir</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setPreset('full_table')}
          className={currentPreset === 'full_table' ? 'bg-slate-100' : ''}
        >
          <Table className="w-4 h-4 mr-2" />
          <div>
            <div className="font-medium">Full Table</div>
            <div className="text-xs text-slate-500">Vue tableau (20-60 lignes)</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-slate-500">
          Raccourcis: F6 (suivant) • Maj+F6 (précédent)
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
