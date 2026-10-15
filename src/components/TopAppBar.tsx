import React from 'react';
import { TabType } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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

  return (
    <header
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      // backdrop-blur-sm en vez de -md: el fondo ya es casi opaco (bg-white/95,
      // bg-[#0a1120]/90) así que el blur aporta poco visualmente, pero en un header fixed
      // que siempre está recompositando (sobre todo con las cartas de Descubrir
      // arrastrándose debajo) puede disparar el bug de Chrome Android que deja pegado
      // un frame viejo de otra pestaña detrás del blur — bajar la intensidad reduce esa
      // chance sin cambiar cómo se ve.
      className={`fixed top-0 w-full z-50 transition-colors duration-200 border-b backdrop-blur-sm glass-surface shadow-elevation-sm ${
        isLight ? 'bg-[#fcf9f2]/90 border-black/8' : 'bg-[#0a1120]/90 border-[#ec4d86]/20'
      }`}
    >
      {/* En la Tienda acompaña el lienzo ancho de desktop (.app-page--wide). */}
      <div
        className={`flex justify-between items-center h-16 px-2 min-[380px]:px-3 max-w-[440px] md:max-w-[560px] min-[1280px]:max-w-[600px] ${
          currentTab === 'tienda' ? 'lg:max-w-[1040px] min-[1280px]:max-w-[1040px]' : ''
        } mx-auto gap-1 min-[380px]:gap-2`}
      >
        {/* Left Action (Back or Menu) */}
        {showBackButton ? (
          <Button
            id="top-back-btn"
            variant="tertiary"
            size="icon"
            onClick={() => {
              sounds.playClick();
              onBack?.();
            }}
            className={`rounded-full transition-colors ${
              isLight
                ? 'text-[#16223b] hover:text-[#ec4d86] hover:bg-[#fcf9f2]'
                : 'text-[#ffa3c4] hover:text-[#ec4d86] hover:bg-white/5'
            }`}
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
            className={`rounded-full transition-colors ${
              isLight
                ? 'text-[#16223b] hover:text-[#ec4d86] hover:bg-[#fcf9f2]'
                : 'text-[#ffa3c4] hover:text-[#ec4d86] hover:bg-white/5'
            }`}
            aria-label="Menú principal"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </Button>
        )}

        {/* Brand Center — small wordmark, no gradient/uppercase drama, matching the rest of the app */}
        <div
          className="flex flex-col items-center justify-center cursor-pointer select-none"
          onClick={() => onTabChange('descubrir')}
        >
          {/* Los títulos de pantalla (Recompensas, Ajustes, Matches...) usaban font-headline-md
              (Manrope) — el resto del rediseño ya pasó los titulares editoriales a Fraunces
              itálica (per Store.dc.html: `font-family:var(--font-display)`), así que se
              alinean acá para no quedar como el único texto grande en Manrope de la app. El
              wordmark "FINDY" (sin customTitle) ya usaba Fraunces vía .font-wordmark. */}
          <h1
            className={`font-bold text-[#ec4d86] ${customTitle ? 'text-[18px] italic font-semibold' : 'text-[17px] font-wordmark'}`}
            style={customTitle ? { fontFamily: 'var(--font-display)' } : undefined}
          >
            {customTitle || 'FINDY'}
          </h1>
          {customSubtitle && (
            <span className={`text-[10px] -mt-0.5 ${isLight ? 'text-[#5b6478]' : 'text-[#8a93a8]'}`}>{customSubtitle}</span>
          )}
        </div>

        {/* Right Actions: Notifications & Wallet Balance (el toggle de tema vive en Ajustes) */}
        <div className="flex items-center gap-1.5">
          <NotificationBell onNavigate={onNavigateNotification} />

          {/* Wallet Balance */}
          <Button
            id="top-wallet-btn"
            variant="secondary"
            size="sm"
            onClick={() => {
              sounds.playCoins();
              onTabChange('tienda');
            }}
            className={`relative h-8 px-2.5 rounded-[var(--radius-md)] active:scale-95 flex items-center gap-1.5 group border transition-all duration-200 shadow-elevation-sm hover:shadow-elevation-md ${
              isLight
                ? 'bg-[#ffffff] text-[#16223b] border-[#ffe0ec] hover:border-[#ec4d86]'
                : 'bg-[#131f36] text-[#ffa3c4] hover:text-[#ffa3c4] border-[#ec4d86]/30'
            }`}
            aria-label="Tienda y saldo Findy Coins"
            title="Ver Tienda & Monedas"
          >
            <span
              className="material-symbols-outlined text-[18px] text-[#ec4d86] group-hover:scale-110 transition-transform"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              monetization_on
            </span>
            <span
              className={`font-meta-data text-[11px] font-bold px-0.5 ${
                isLight ? 'text-[#ec4d86]' : 'text-[#ffa3c4]'
              }`}
            >
              {walletBalance.toLocaleString()}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
};
