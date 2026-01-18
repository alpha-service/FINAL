import { useState, useEffect, createContext, useContext } from 'react';

// 3 completely different UI design modes
export const DESIGNS = {
  CLASSIC: 'classic',     // Current design - traditional POS
  MODERN: 'modern',       // Sleek, glassmorphism, rounded
  MINIMAL: 'minimal'      // Ultra-clean, flat, monochrome
};

export const DESIGN_CONFIG = {
  [DESIGNS.CLASSIC]: {
    name: 'Classic / Classique',
    nameNL: 'Klassiek',
    description: 'Design traditionnel ALPHA&CO',
    // Layout
    sidebarStyle: 'solid',
    cardStyle: 'shadow',
    buttonStyle: 'solid',
    inputStyle: 'bordered',
    // Spacing
    borderRadius: 'rounded-lg',
    buttonRadius: 'rounded-md',
    cardRadius: 'rounded-lg',
    // Visual Effects
    useGradients: false,
    useGlass: false,
    useShadows: true,
    // Typography
    headingWeight: 'font-bold',
    // Colors overlay
    cardBg: 'bg-white',
    surfaceBg: 'bg-slate-50',
    borderColor: 'border-slate-200',
    // Button styles
    primaryButton: 'bg-brand-orange hover:bg-brand-orange/90 text-white',
    secondaryButton: 'bg-brand-navy hover:bg-brand-navy/90 text-white',
    ghostButton: 'hover:bg-slate-100',
    // Header
    headerStyle: 'solid',
    // Sidebar  
    sidebarWidth: 'w-64',
    navItemStyle: 'rounded-lg',
    // Input
    inputBorder: 'border border-slate-300',
    inputFocus: 'focus:ring-2 focus:ring-brand-navy/20',
    // Product cards
    productCardStyle: 'border border-slate-200 hover:border-brand-navy hover:shadow-md',
    // Icons
    iconSize: 'w-4 h-4',
    // Animations
    transition: 'transition-all duration-200'
  },
  [DESIGNS.MODERN]: {
    name: 'Modern / Moderne',
    nameNL: 'Modern',
    description: 'Design moderne avec effets glass',
    // Layout
    sidebarStyle: 'glass',
    cardStyle: 'glass',
    buttonStyle: 'gradient',
    inputStyle: 'glass',
    // Spacing
    borderRadius: 'rounded-2xl',
    buttonRadius: 'rounded-xl',
    cardRadius: 'rounded-2xl',
    // Visual Effects
    useGradients: true,
    useGlass: true,
    useShadows: true,
    // Typography
    headingWeight: 'font-semibold',
    // Colors overlay
    cardBg: 'bg-white/80 backdrop-blur-lg',
    surfaceBg: 'bg-gradient-to-br from-slate-100 to-slate-200',
    borderColor: 'border-white/20',
    // Button styles
    primaryButton: 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg shadow-orange-500/25',
    secondaryButton: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25',
    ghostButton: 'hover:bg-white/50 backdrop-blur',
    // Header
    headerStyle: 'glass',
    // Sidebar
    sidebarWidth: 'w-72',
    navItemStyle: 'rounded-xl',
    // Input
    inputBorder: 'border border-white/30 bg-white/50 backdrop-blur',
    inputFocus: 'focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50',
    // Product cards
    productCardStyle: 'bg-white/70 backdrop-blur border border-white/30 hover:bg-white/90 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1',
    // Icons
    iconSize: 'w-5 h-5',
    // Animations
    transition: 'transition-all duration-300 ease-out'
  },
  [DESIGNS.MINIMAL]: {
    name: 'Minimal / Minimaal',
    nameNL: 'Minimalistisch',
    description: 'Design ultra-épuré et fonctionnel',
    // Layout
    sidebarStyle: 'flat',
    cardStyle: 'flat',
    buttonStyle: 'outline',
    inputStyle: 'underline',
    // Spacing
    borderRadius: 'rounded-none',
    buttonRadius: 'rounded-none',
    cardRadius: 'rounded-none',
    // Visual Effects
    useGradients: false,
    useGlass: false,
    useShadows: false,
    // Typography
    headingWeight: 'font-medium',
    // Colors overlay
    cardBg: 'bg-white',
    surfaceBg: 'bg-neutral-100',
    borderColor: 'border-neutral-300',
    // Button styles
    primaryButton: 'bg-black hover:bg-neutral-800 text-white',
    secondaryButton: 'border-2 border-black text-black hover:bg-black hover:text-white',
    ghostButton: 'hover:bg-neutral-100',
    // Header
    headerStyle: 'flat',
    // Sidebar
    sidebarWidth: 'w-56',
    navItemStyle: 'rounded-none border-l-2 border-transparent',
    // Input
    inputBorder: 'border-0 border-b-2 border-neutral-300 bg-transparent',
    inputFocus: 'focus:border-black focus:ring-0',
    // Product cards
    productCardStyle: 'border-2 border-neutral-200 hover:border-black',
    // Icons
    iconSize: 'w-4 h-4',
    // Animations
    transition: 'transition-colors duration-150'
  }
};

const DesignContext = createContext(null);

export function DesignProvider({ children }) {
  const [currentDesign, setCurrentDesign] = useState(() => {
    const saved = localStorage.getItem('app_design');
    return saved || DESIGNS.CLASSIC;
  });

  const design = DESIGN_CONFIG[currentDesign];

  useEffect(() => {
    localStorage.setItem('app_design', currentDesign);
    
    // Apply design classes to root
    document.documentElement.setAttribute('data-design', currentDesign);
    
    // Apply CSS custom properties for design
    const root = document.documentElement;
    root.style.setProperty('--design-radius', design.borderRadius === 'rounded-none' ? '0' : design.borderRadius === 'rounded-2xl' ? '1rem' : '0.5rem');
    root.style.setProperty('--design-shadow', design.useShadows ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none');
  }, [currentDesign, design]);

  const changeDesign = (designId) => {
    if (DESIGN_CONFIG[designId]) {
      setCurrentDesign(designId);
    }
  };

  const value = {
    currentDesign,
    setCurrentDesign: changeDesign,  // Alias for direct setting
    design,
    changeDesign,
    DESIGNS,
    DESIGN_CONFIG
  };

  return (
    <DesignContext.Provider value={value}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const context = useContext(DesignContext);
  if (!context) {
    // Fallback for when used outside provider
    return {
      currentDesign: DESIGNS.CLASSIC,
      setCurrentDesign: () => {},  // Alias
      design: DESIGN_CONFIG[DESIGNS.CLASSIC],
      changeDesign: () => {},
      DESIGNS,
      DESIGN_CONFIG
    };
  }
  return context;
}

// Utility function to get conditional classes based on design
export function getDesignClasses(design, type) {
  const d = DESIGN_CONFIG[design] || DESIGN_CONFIG[DESIGNS.CLASSIC];
  
  switch (type) {
    case 'card':
      return `${d.cardBg} ${d.cardRadius} ${d.borderColor} ${d.transition}`;
    case 'button-primary':
      return `${d.primaryButton} ${d.buttonRadius} ${d.transition}`;
    case 'button-secondary':
      return `${d.secondaryButton} ${d.buttonRadius} ${d.transition}`;
    case 'input':
      return `${d.inputBorder} ${d.inputFocus} ${d.buttonRadius}`;
    case 'product-card':
      return `${d.productCardStyle} ${d.cardRadius} ${d.transition}`;
    case 'nav-item':
      return `${d.navItemStyle} ${d.transition}`;
    case 'surface':
      return `${d.surfaceBg}`;
    default:
      return '';
  }
}
