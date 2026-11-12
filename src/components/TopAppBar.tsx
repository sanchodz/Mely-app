import React from 'react';
import { TabType } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { NotificationBell } from './NotificationBell';

interface TopAppBarProps {
  currentTab: TabType;
  walletBalance: number;
  onTabChange: (tab: TabType) => void;
  onNavigateNotification: (category?: string, data?: Record<string, unknown>) => void;
  onOpenMenu: () => void;
  customTitle?: string;
  customSubtitle?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  currentTab,
  walletBalance,
  onTabChange,
  onNavigateNotification,
  onOpenMenu,
  customTitle,
  customSubtitle,
  showBackButton = false,
  onBack,
}) => {
  const { isLight } = useTheme();

  // Botón izquierdo (volver / menú): 44px de área táctil, icono 24px, sin fondo en reposo.
  const leftButtonClass = `rounded-full transition-colors ${
    isLight ? 'text-[#16223b] hover:bg-black/5' : 'text-[#f5f1e8] hover:bg-white/8'
  }`;

  return (
    <header
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      // backdrop-blur-sm en vez de -md: el fondo ya es casi opaco (bg-white/95,
      // bg-[#0a1120]/90) así que el blur aporta poco visualmente, pero en un header fixed
      // que siempre está recompositando (sobre todo con las cartas de Descubrir
      // arrastrándose debajo) puede disparar el bug de Chrome Android que deja pegado
      // un frame viejo de otra pestaña detrás del blur — bajar la intensidad reduce esa
      // chance sin cambiar cómo se ve.
      className={`fixed top-0 w-full z-50 transition-colors duration-200 border-b backdrop-blur-sm ${
        isLight ? 'bg-[#fcf9f2]/92 border-black/[0.07]' : 'bg-[#0a1120]/92 border-white/[0.08]'
      }`}
    >
      {/* En la Tienda acompaña el lienzo ancho de desktop (.app-page--wide). */}
      <div
        className={`grid grid-cols-[1fr_auto_1fr] items-center h-16 px-2 min-[380px]:px-3 max-w-[440px] md:max-w-[560px] min-[1280px]:max-w-[600px] ${
          currentTab === 'tienda' ? 'lg:max-w-[1040px] min-[1280px]:max-w-[1040px]' : ''
        } mx-auto gap-2`}
      >
        {/* Left Action (Back or Menu) */}
        <div className="flex items-center justify-start">
          {showBackButton ? (
            <Button
              id="top-back-btn"
              variant="tertiary"
              size="icon"
              onClick={() => {
                sounds.playClick();
                onBack?.();
              }}
              className={leftButtonClass}
              aria-label="Volver"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Button>
          ) : (
            <Button
              id="top-menu-btn"
              variant="tertiary"
              size="icon"
              onClick={() => {
                sounds.playClick();
                onOpenMenu();
              }}
              className={leftButtonClass}
              aria-label="Menú principal"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </Button>
          )}
        </div>

        {/* Brand Center — queda centrado de verdad gracias a la grilla 1fr/auto/1fr
            (antes dependía del ancho de los botones laterales y se corría). */}
        <div
          className="flex flex-col items-center justify-center cursor-pointer select-none min-w-0 px-1"
          onClick={() => onTabChange('descubrir')}
        >
          {/* Los títulos de pantalla (Recompensas, Ajustes, Matches...) usaban font-headline-md
              (Manrope) — el resto del rediseño ya pasó los titulares editoriales a Fraunces
              itálica (per Store.dc.html: `font-family:var(--font-display)`), así que se
              alinean acá para no quedar como el único texto grande en Manrope de la app. El
              wordmark "FINDY" (sin customTitle) ya usaba Fraunces vía .font-wordmark. */}
          <h1
            className={`truncate leading-none ${
              customTitle
                ? `text-[21px] italic font-semibold ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`
                : 'text-[18px] font-bold font-wordmark text-[#ec4d86] tracking-[0.02em]'
            }`}
            style={customTitle ? { fontFamily: 'var(--font-display)' } : undefined}
          >
            {customTitle || 'FINDY'}
          </h1>
          {customSubtitle && (
            <span className={`text-[11px] mt-1 leading-none truncate ${isLight ? 'text-[#5b6478]' : 'text-[#8a93a8]'}`}>
              {customSubtitle}
            </span>
          )}
        </div>

        {/* Right Actions: Notifications & Wallet Balance (el toggle de tema vive en Ajustes) */}
        <div className="flex items-center justify-end gap-2">
          <NotificationBell onNavigate={onNavigateNotification} />

          {/* Wallet Balance — píldora compacta; hit-slop extiende el tap a 44px. */}
          <Button
            id="top-wallet-btn"
            variant="secondary"
            size="sm"
            onClick={() => {
              sounds.playCoins();
              onTabChange('tienda');
            }}
            className={`hit-slop h-9 pl-2 pr-3 gap-1.5 shadow-none ${
              isLight
                ? 'bg-white border-black/[0.08] hover:border-[#ec4d86]/50'
                : 'bg-white/[0.06] border-white/10 hover:border-[#ff6b9e]/50'
            }`}
            aria-label="Tienda y saldo Findy Coins"
            title="Ver Tienda & Monedas"
          >
            <span
              className="material-symbols-outlined text-[19px] text-[#ec4d86]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monetization_on
            </span>
            <span className={`font-meta-data text-[13px] font-extrabold tabular-nums ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
              {walletBalance.toLocaleString()}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
};
