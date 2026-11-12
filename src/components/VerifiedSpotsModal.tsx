import React, { useState } from 'react';
import { motion } from 'motion/react';
import { VerifiedSpot } from '../types';
import { VERIFIED_SPOTS } from '../data/mockData';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';

interface VerifiedSpotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpotToPropose?: (spot: VerifiedSpot) => void;
}

export const VerifiedSpotsModal: React.FC<VerifiedSpotsModalProps> = ({
  isOpen,
  onClose,
  onSelectSpotToPropose,
}) => {
  const { isLight } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSpot, setSelectedSpot] = useState<VerifiedSpot | null>(null);

  const categories = [
    { id: 'all', label: 'Todos los Rincones', icon: 'explore' },
    { id: 'cafe', label: 'Café & Tostadores', icon: 'coffee' },
    { id: 'cocktail', label: 'Speakeasies & Tragos', icon: 'local_bar' },
    { id: 'wine', label: 'Vinos & Bodegones', icon: 'wine_bar' },
    { id: 'books', label: 'Libros & Cultura', icon: 'menu_book' },
  ];

  const filteredSpots = selectedCategory === 'all'
    ? VERIFIED_SPOTS
    : VERIFIED_SPOTS.filter((s) => s.category === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`w-[calc(100%-1.5rem)] max-w-[440px] max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden ${
          isLight ? 'bg-[var(--color-canvas)]' : 'bg-[var(--midnight-950)]'
        }`}
      >
        {/* Modal Header */}
        <DialogHeader
          className={`p-4 pr-14 border-b flex-row items-center shrink-0 space-y-0 ${
            isLight ? 'bg-white border-[var(--color-line)]' : 'bg-[var(--midnight-900)] border-[var(--hairline)]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[var(--radius-md)] bg-gradient-to-tr from-[#ec4d86] to-[#ff6b9e] flex items-center justify-center text-white shadow-[var(--shadow-coral)] shrink-0">
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
            </div>
            <div className="min-w-0">
              <span className="section-kicker block">Lugares asociados y beneficios</span>
              <h2 className={`text-[20px] italic font-semibold leading-tight mt-1 ${isLight ? 'text-[var(--text-on-light)]' : 'text-[var(--text-primary)]'}`} style={{ fontFamily: 'var(--font-display)' }}>
                Rincones de citas Findy
              </h2>
            </div>
          </div>
        </DialogHeader>

        {/* Category Pills Bar */}
        <div
          className={`px-4 py-3 border-b flex gap-2 overflow-x-auto no-scrollbar shrink-0 ${
            isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[var(--midnight-950)] border-[var(--hairline)]'
          }`}
        >
          {categories.map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  sounds.playClick();
                  setSelectedCategory(cat.id);
                }}
                className={`h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isCatActive
                    ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white shadow-[var(--shadow-coral)]'
                    : isLight
                    ? 'bg-white border border-[var(--color-line)] text-[var(--text-on-light)] hover:text-[#ec4d86]'
                    : 'bg-[var(--midnight-900)] border border-[var(--hairline-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Spots Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
          {filteredSpots.map((spot) => (
            <motion.div
              key={spot.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-[var(--radius-lg)] overflow-hidden shadow-elevation-sm transition-all duration-200 ${
                isLight
                  ? 'bg-white border-[var(--color-line)] hover:border-[#ec4d86]/50 hover:shadow-elevation-md'
                  : 'bg-[var(--midnight-900)] border-[var(--hairline-strong)] hover:border-[#ec4d86]/60 hover:shadow-elevation-md'
              }`}
            >
              {/* Photo & Badge */}
              <div className="relative h-40 w-full overflow-hidden bg-slate-900">
                <img
                  src={spot.image}
                  alt={spot.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* Rating badge */}
                <div className="absolute top-3 right-3 h-7 bg-black/60 backdrop-blur-md px-2.5 rounded-[var(--radius-pill)] flex items-center gap-1 border border-white/20">
                  <span className="material-symbols-outlined text-[14px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  <span className="text-[12px] font-bold text-white tabular-nums">{spot.rating}</span>
                </div>

                {/* Neighborhood badge */}
                <div className="absolute top-3 left-3 h-7 inline-flex items-center bg-[#ec4d86]/90 backdrop-blur-md text-white text-[10.5px] font-bold uppercase tracking-[0.08em] px-2.5 rounded-full">
                  {spot.neighborhood}
                </div>

                {/* Name on image */}
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-[20px] italic font-semibold text-white leading-tight drop-shadow-sm" style={{ fontFamily: 'var(--font-display)' }}>
                    {spot.name}
                  </h3>
                  <p className="text-[12.5px] text-white/85 flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[14px] text-[#ffa3c4]">location_on</span>
                    {spot.address}
                  </p>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-4 flex flex-col gap-3">
                {/* FINDY Perk Banner */}
                <div
                  className={`p-3 rounded-[var(--radius-md)] border flex items-center gap-3 ${
                    isLight
                      ? 'bg-[var(--color-rose-soft)] border-[var(--coral-100)] text-[var(--coral-700)]'
                      : 'bg-[var(--coral-500)]/10 border-[var(--coral-500)]/25 text-[var(--coral-300)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                    loyalty
                  </span>
                  <span className="text-[13px] font-bold leading-snug">
                    {spot.melyPerk}
                  </span>
                </div>

                {/* Vibe & Stamp Preview */}
                <div className="flex items-center justify-between gap-3 px-0.5">
                  <span className={`text-[13px] italic leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                    “{spot.vibe}”
                  </span>
                  <span className="shrink-0 font-bold text-[12px] h-7 px-2.5 inline-flex items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                    {spot.averagePrice}
                  </span>
                </div>

                {/* Action button: Proponer cita */}
                <div className={`pt-3 border-t border-dashed flex justify-between items-center gap-3 ${isLight ? 'border-[var(--color-line)]' : 'border-[var(--hairline-strong)]'}`}>
                  <span className={`inline-flex items-center gap-1 text-[12.5px] min-w-0 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                    <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">schedule</span>
                    <span className="truncate">{spot.recommendedTime}</span>
                  </span>

                  <Button
                    size="sm"
                    onClick={() => {
                      sounds.playStamp();
                      if (onSelectSpotToPropose) {
                        onSelectSpotToPropose(spot);
                      }
                      onClose();
                    }}
                    className="h-10 rounded-full px-4 text-[13px] gap-1.5 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Proponer cita acá
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
