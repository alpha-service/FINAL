import { useState, useEffect } from 'react';
import { toast } from 'sonner';

// 5 Professional Layout Presets
const LAYOUT_PRESETS = {
  CLASSIC: 'classic',        // Classic 60/40 split
  COMPACT: 'compact',        // Maximum product space 70/30
  WIDE_CART: 'wide_cart',    // Wide cart 50/50
  VERTICAL: 'vertical',      // Vertical split (products top, cart bottom)
  FOCUS: 'focus'            // Full screen with drawer cart
};

const PRESET_CONFIG = {
  [LAYOUT_PRESETS.CLASSIC]: {
    name: 'Classique',
    nameNL: 'Klassiek',
    description: 'Division équilibrée',
    icon: 'LayoutGrid',
    layout: 'horizontal',
    defaultWidth: 60,      // % for products
    minWidth: 45,
    maxWidth: 75,
    cartPosition: 'right',
    showDrawer: false,
    cartStyle: 'compact',
    gridColumns: 4,
    categoryBar: 'top'
  },
  [LAYOUT_PRESETS.COMPACT]: {
    name: 'Compact',
    nameNL: 'Compact',
    description: 'Maximum produits',
    icon: 'Maximize2',
    layout: 'horizontal',
    defaultWidth: 70,
    minWidth: 60,
    maxWidth: 85,
    cartPosition: 'right',
    showDrawer: false,
    cartStyle: 'compact',
    gridColumns: 5,
    categoryBar: 'top'
  },
  [LAYOUT_PRESETS.WIDE_CART]: {
    name: 'Panier Large',
    nameNL: 'Brede Winkelwagen',
    description: 'Panier spacieux',
    icon: 'Columns',
    layout: 'horizontal',
    defaultWidth: 50,
    minWidth: 40,
    maxWidth: 60,
    cartPosition: 'right',
    showDrawer: false,
    cartStyle: 'table',
    gridColumns: 3,
    categoryBar: 'top'
  },
  [LAYOUT_PRESETS.VERTICAL]: {
    name: 'Vertical',
    nameNL: 'Verticaal',
    description: 'Haut/Bas',
    icon: 'PanelTop',
    layout: 'vertical',
    defaultWidth: 60,      // % for products (height)
    minWidth: 50,
    maxWidth: 75,
    cartPosition: 'bottom',
    showDrawer: false,
    cartStyle: 'table',
    gridColumns: 6,
    categoryBar: 'side'
  },
  [LAYOUT_PRESETS.FOCUS]: {
    name: 'Mode Focus',
    nameNL: 'Focus Modus',
    description: 'Plein écran',
    icon: 'Maximize',
    layout: 'drawer',
    defaultWidth: 100,
    minWidth: 100,
    maxWidth: 100,
    cartPosition: 'drawer',
    showDrawer: true,
    cartStyle: 'compact',
    gridColumns: 6,
    categoryBar: 'top'
  }
};

export function usePOSLayout() {
  const [currentPreset, setCurrentPreset] = useState(() => {
    const saved = localStorage.getItem('pos_layout_preset');
    return saved || LAYOUT_PRESETS.CLASSIC;
  });

  const [cartWidth, setCartWidth] = useState(() => {
    const presetToUse = localStorage.getItem('pos_layout_preset') || LAYOUT_PRESETS.CLASSIC;
    const saved = localStorage.getItem(`pos_cart_width_${presetToUse}`);
    const config = PRESET_CONFIG[presetToUse];
    return saved ? parseFloat(saved) : config?.defaultWidth || 60;
  });

  const [drawerOpen, setDrawerOpen] = useState(false);

  const config = PRESET_CONFIG[currentPreset] || PRESET_CONFIG[LAYOUT_PRESETS.CLASSIC];

  // Update cart width with constraints
  const updateCartWidth = (newWidth) => {
    const constrainedWidth = Math.max(
      config.minWidth,
      Math.min(config.maxWidth, newWidth)
    );
    setCartWidth(constrainedWidth);
    localStorage.setItem(`pos_cart_width_${currentPreset}`, constrainedWidth.toString());
  };

  // Change preset
  const changePreset = (preset) => {
    setCurrentPreset(preset);
    localStorage.setItem('pos_layout_preset', preset);
    
    // Load saved width for this preset or use default
    const saved = localStorage.getItem(`pos_cart_width_${preset}`);
    const newConfig = PRESET_CONFIG[preset];
    const newWidth = saved ? parseFloat(saved) : newConfig.defaultWidth;
    setCartWidth(newWidth);
    
    toast.success(`Layout: ${newConfig.name}`);
  };

  // Cycle through layouts (keyboard shortcut)
  const cycleLayout = () => {
    const presets = Object.values(LAYOUT_PRESETS);
    const currentIndex = presets.indexOf(currentPreset);
    const nextIndex = (currentIndex + 1) % presets.length;
    changePreset(presets[nextIndex]);
  };

  return {
    currentPreset,
    setCurrentPreset: changePreset,
    config,
    cartWidth,
    setCartWidth,
    updateCartWidth,
    cycleLayout,
    drawerOpen,
    setDrawerOpen,
    LAYOUT_PRESETS,
    PRESET_CONFIG
  };
}

export { LAYOUT_PRESETS, PRESET_CONFIG };
