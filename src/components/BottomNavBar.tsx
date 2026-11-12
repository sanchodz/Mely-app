import React from 'react';
import { motion } from 'motion/react';
import { TabType } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';

interface BottomNavBarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadMessagesCount: number;
  newLikesCount: number;
  userAvatar?: string;
}

// Barra chata de 5 tabs (Descubrir / Me gusta / Tienda / Chats / Perfil), pegada al
// borde inferior. La Tienda volvió a la navegación principal con el mismo peso visual
// que el resto (sin botón flotante ni destacado extra): ícono + label, y el trazo rosa
// sobre una píldora translúcida cuando está activa. Citas, Matches y Ajustes siguen
// viviendo en el menú hamburguesa.
export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  onTabChange,
  unreadMessagesCount,
  newLikesCount,
  userAvatar,
}) => {
  const { isLight } = useTheme();

  const tabs: {
    id: TabType;
    label: string;
    icon: string;
    badge?: number;
  }[] = [
    {
      id: 'descubrir',
      label: 'Descubrir',
      icon: 'explore',
    },
    {
      id: 'likes',
      label: 'Me gusta',
      icon: 'favorite',
      badge: newLikesCount,
    },
    {
      id: 'tienda',
      label: 'Tienda',
      icon: 'local_mall',
    },
    {
      id: 'mensajes',
      label: 'Chats',
      icon: 'chat_bubble',
      badge: unreadMessagesCount,
    },
    {
      id: 'perfil',
      label: 'Perfil',
      icon: 'person',
    },
  ];

  const navBg = isLight ? '#FCF9F2' : 'var(--midnight-950)';
  const inactiveColor = isLight ? 'var(--text-on-light-muted)' : 'var(--text-secondary)';

  return (
    <nav
      id="bottom-navigation-bar"
      aria-label="Navegación principal"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: navBg,
        borderTop: `1px solid ${isLight ? 'rgba(22,34,59,0.08)' : 'var(--hairline)'}`,
        boxShadow: isLight ? '0 -8px 24px -16px rgba(10,17,32,0.18)' : '0 -8px 24px -16px rgba(0,0,0,0.6)',
      }}
      className="fixed inset-x-0 bottom-0 z-50"
    >
      {/* 78px: igual que antes, para que el padding inferior de <main> siga coincidiendo. */}
      <div className="flex justify-around items-stretch w-full max-w-[440px] md:max-w-[560px] min-[1280px]:max-w-[600px] mx-auto h-[78px] pb-[10px] px-1">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const hasBadge = tab.badge !== undefined && tab.badge > 0;

          return (
            <motion.button
              key={tab.id}
              id={`nav-btn-${tab.id}`}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                sounds.playClick();
                onTabChange(tab.id);
              }}
              aria-label={tab.badge ? `${tab.label}, ${tab.badge} nuevos` : tab.label}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]/50 rounded-[var(--radius-md)]"
            >
              {/* Píldora 56x32: más ancha que el icono para leerse como "pestaña",
                  sin borde (el borde rosa + relleno + icono relleno era triple señal). */}
              <span className="relative flex items-center justify-center w-14 h-8 rounded-[var(--radius-pill)]">
                {isActive && (
                  <motion.div
                    layoutId="bottomNavActivePill"
                    layout="position"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-[var(--radius-pill)]"
                    style={{ background: isLight ? 'rgba(255, 107, 158, 0.16)' : 'rgba(255, 107, 158, 0.18)' }}
                  />
                )}

                {hasBadge && (
                  <span
                    className="absolute -top-1 right-1.5 z-10 count-badge min-w-[18px] h-[18px] text-[10px]"
                    style={{ boxShadow: `0 0 0 2px ${navBg}` }}
                  >
                    {tab.badge! > 99 ? '99+' : tab.badge}
                  </span>
                )}

                {tab.id === 'perfil' && userAvatar ? (
                  <span
                    className="relative z-10 w-[26px] h-[26px] rounded-[var(--radius-pill)] overflow-hidden transition-all"
                    style={{
                      boxShadow: isActive
                        ? '0 0 0 2px var(--coral-500)'
                        : `0 0 0 1.5px ${isLight ? 'rgba(22,34,59,0.18)' : 'var(--hairline-strong)'}`,
                    }}
                  >
                    <img
                      src={userAvatar}
                      alt="Perfil"
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover"
                    />
                  </span>
                ) : (
                  <span
                    className="relative z-10 material-symbols-outlined text-[24px] transition-colors leading-none"
                    style={{
                      color: isActive ? 'var(--coral-500)' : inactiveColor,
                      fontVariationSettings: isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
                    }}
                  >
                    {tab.icon}
                  </span>
                )}
              </span>
              {/* Label en caja normal, 11px: las versalitas de 9px eran la parte más
                  ruidosa de la barra y la menos legible. */}
              <span
                className="font-label-caps text-[11px] leading-none tracking-[0.01em] transition-colors"
                style={{
                  color: isActive ? 'var(--coral-500)' : inactiveColor,
                  fontWeight: isActive ? 800 : 600,
                }}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
