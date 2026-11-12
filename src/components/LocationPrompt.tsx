import React, { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { sounds } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUpdateLocation } from '../hooks/useProfile';
import { getCurrentCoords } from '../lib/geolocation';

/**
 * Sin esto, el filtro de distancia del backend queda inactivo (si a alguno de los dos
 * perfiles le falta latitud/longitud, la comparación se salta directamente — ver
 * discovery/service.ts matchesFilters) y Descubrir termina mostrando gente de
 * cualquier ciudad del país, no solo la cercana.
 */
export const LocationPrompt: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { isLight } = useTheme();
  const updateLocation = useUpdateLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.hasLocation || dismissed) return null;

  const handleActivate = async () => {
    sounds.playClick();
    try {
      const coords = await getCurrentCoords();
      await updateLocation.mutateAsync(coords);
      await refreshUser();
      sounds.playStamp();
      toast.success('Ubicación activada. Ahora vas a ver gente cerca tuyo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos activar tu ubicación.');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`rounded-[var(--radius-md)] border p-3 flex items-center gap-3 ${
          isLight ? 'bg-white border-[#ffe0ec] shadow-elevation-sm' : 'bg-[#0f1a2e] border-[#ec4d86]/20'
        }`}
        role="region"
        aria-label="Activar ubicación"
      >
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
            isLight ? 'bg-[#ffe0ec]/70 text-[#ec4d86]' : 'bg-[#ec4d86]/15 text-[#ffa3c4]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            location_on
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <span className={`block text-[13.5px] font-bold leading-tight ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
            Activá tu ubicación
          </span>
          <span className={`block text-[11.5px] mt-0.5 leading-snug ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
            Así te mostramos gente cerca tuyo, no de cualquier ciudad.
          </span>
        </div>
        <button
          type="button"
          onClick={handleActivate}
          disabled={updateLocation.isPending}
          className="shrink-0 h-10 px-4 rounded-full bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white text-[12.5px] font-bold shadow-elevation-sm active:scale-95 transition-transform disabled:opacity-60"
        >
          {updateLocation.isPending ? '…' : 'Activar'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={`shrink-0 w-9 h-9 -mr-1 rounded-full flex items-center justify-center hit-slop ${
            isLight ? 'text-[#5b6478] hover:bg-[#efe7d8]' : 'text-white/40 hover:bg-white/8'
          }`}
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
