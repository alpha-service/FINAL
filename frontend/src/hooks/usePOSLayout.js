import { useState, useEffect } from 'react';

const LAYOUT_PRESETS = {
  SPLIT_CLASSIC: 'split_classic',
  CART_FOCUS: 'cart_focus',
  BOTTOM_DRAWER: 'bottom_drawer',
  FULL_TABLE: 'full_table'
};

const PRESET_CONFIG = {
  [LAYOUT_PRESETS.SPLIT_CLASSIC]: {
    name: 'Classic Split',
    cartWidth: 450,
    minCartWidth: 420,
    maxCartWidth: 700,
    resizable: true,
    showDrawer: false,
    cartStyle: 'compact'
  },
  [LAYOUT_PRESETS.CART_FOCUS]: {
    name: 'Cart Focus',
    cartWidth: 600,
    minCartWidth: 550,
    maxCartWidth: 700,
    resizable: true,
    showDrawer: false,
    cartStyle: 'compact'
  },
  [LAYOUT_PRESETS.BOTTOM_DRAWER]: {
    name: 'Bottom Drawer',
    cartWidth: 0,
    resizable: false,
    showDrawer: true,
    cartStyle: 'compact'
  },
  [LAYOUT_PRESETS.FULL_TABLE]: {
    name: 'Full Table',
    cartWidth: 650,
    minCartWidth: 600,
    maxCartWidth: 900,
    resizable: true,
    showDrawer: false,
    cartStyle: 'table'
  }
};

export function usePOSLayout() {
  const [currentPreset, setCurrentPreset] = useState(() => {
    const saved = localStorage.getItem('pos_layout_preset');
    return saved || LAYOUT_PRESETS.SPLIT_CLASSIC;
  });

  const [cartWidth, setCartWidth] = useState(() => {
    const saved = localStorage.getItem('pos_cart_width');
    return saved ? parseInt(saved) : PRESET_CONFIG[currentPreset].cartWidth;
  });

  const [drawerOpen, setDrawerOpen] = useState(false);

  const config = PRESET_CONFIG[currentPreset];

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('pos_layout_preset', currentPreset);
  }, [currentPreset]);

  useEffect(() => {
    if (config.resizable) {
      localStorage.setItem('pos_cart_width', cartWidth.toString());
    }
  }, [cartWidth, config.resizable]);

  const cycleLayout = (forward = true) => {
    const presets = Object.values(LAYOUT_PRESETS);
    const currentIndex = presets.indexOf(currentPreset);
    const nextIndex = forward 
      ? (currentIndex + 1) % presets.length
      : (currentIndex - 1 + presets.length) % presets.length;
    setCurrentPreset(presets[nextIndex]);
    setCartWidth(PRESET_CONFIG[presets[nextIndex]].cartWidth);
  };

  const updateCartWidth = (width) => {
    if (!config.resizable) return;
    const clampedWidth = Math.max(
      config.minCartWidth,
      Math.min(config.maxCartWidth, width)
    );
    setCartWidth(clampedWidth);
  };

  return {
    currentPreset,
    setCurrentPreset,
    config,
    cartWidth,
    updateCartWidth,
    cycleLayout,
    drawerOpen,
    setDrawerOpen,
    LAYOUT_PRESETS,
    PRESET_CONFIG
  };
}
