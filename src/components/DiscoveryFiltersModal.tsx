import React, { useEffect, useState } from 'react';
import { DiscoveryFilters } from '../types';
import { DEFAULT_DISCOVERY_FILTERS } from '../data/mockData';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { listInterests } from '../lib/api/profile';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';

interface DiscoveryFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: DiscoveryFilters;
  onApplyFilters: (filters: DiscoveryFilters) => void;
}

export const DiscoveryFiltersModal: React.FC<DiscoveryFiltersModalProps> = ({
  isOpen,
  onClose,
  filters: initialFilters,
  onApplyFilters,
}) => {
  const { isLight } = useTheme();
  const [localFilters, setLocalFilters] = useState<DiscoveryFilters>(initialFilters);
  const [interests, setInterests] = useState<{ id: string; slug: string; name: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalFilters(initialFilters);
    listInterests()
      .then(setInterests)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleInterest = (slug: string) => {
    sounds.playClick();
    setLocalFilters((prev) => {
      const exists = prev.selectedInterests.includes(slug);
      return {
        ...prev,
        selectedInterests: exists
          ? prev.selectedInterests.filter((t) => t !== slug)
          : [...prev.selectedInterests, slug],
      };
    });
  };

  const handleReset = () => {
    sounds.playClick();
    setLocalFilters(DEFAULT_DISCOVERY_FILTERS);
  };

  const handleApply = () => {
    sounds.playCoins();
    onApplyFilters(localFilters);
    onClose();
  };

  const activeCount =
    (localFilters.onlyVerifiedMembers ? 1 : 0) +
    (localFilters.withAudioBioOnly ? 1 : 0) +
    localFilters.selectedInterests.length;

  const titleColor = isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]';
  const mutedColor = isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]';
  const sectionTitle = `text-[14px] font-bold ${titleColor}`;
  const valueBadge = `inline-flex items-center h-7 px-2.5 rounded-full text-[12px] font-bold font-mono ${
    isLight ? 'bg-[#ffe0ec]/70 text-[#c9366d]' : 'bg-[#ec4d86]/15 text-[#ffa3c4]'
  }`;
  const toggleRow = 'flex items-center gap-3 px-4 min-h-[64px] py-3';
  const groupClass = `rounded-[var(--radius-md)] border divide-y overflow-hidden ${
    isLight ? 'bg-white border-[#ffe0ec] divide-[#ffe0ec]' : 'bg-[#0a1120]/60 border-white/8 divide-white/8'
  }`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-[420px] max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-[var(--radius-lg)]">
        <DialogHeader
          className={`px-5 pt-5 pb-4 border-b flex-row justify-between items-center shrink-0 space-y-0 ${
            isLight ? 'bg-white border-[#ffe0ec]' : 'bg-[#0f1a2e] border-white/8'
          }`}
        >
          <div className="min-w-0 pr-10 text-left">
            <span className="section-kicker block">Descubrir</span>
            <h3 className={`mt-1 text-[20px] font-extrabold tracking-tight leading-tight ${titleColor}`}>Filtros</h3>
            <p className={`mt-0.5 text-[12px] ${mutedColor}`}>
              {activeCount === 0 ? 'Sin filtros activos' : `${activeCount} ${activeCount === 1 ? 'filtro activo' : 'filtros activos'}`}
            </p>
          </div>
        </DialogHeader>

        {/* Scrollable Filters Content */}
        <div className={`flex-1 overflow-y-auto p-5 flex flex-col gap-6 no-scrollbar ${isLight ? 'bg-[#fcf9f2]' : 'bg-[#0f1a2e]'}`}>
          {/* Distance Slider */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <Label className={sectionTitle + ' normal-case tracking-normal'}>Distancia máxima</Label>
              <span className={valueBadge}>{localFilters.maxDistanceKm} km</span>
            </div>
            <div className="px-1">
              <Slider
                min={1}
                max={50}
                step={1}
                value={[localFilters.maxDistanceKm]}
                onValueChange={([v]) => setLocalFilters((prev) => ({ ...prev, maxDistanceKm: v }))}
              />
            </div>
            <div className={`flex justify-between text-[11px] mt-2 ${mutedColor}`}>
              <span>1 km · mismo barrio</span>
              <span>50 km · toda la ciudad</span>
            </div>
          </section>

          {/* Age Range */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <Label className={sectionTitle + ' normal-case tracking-normal'}>Edad</Label>
              <span className={valueBadge}>
                {localFilters.minAge}–{localFilters.maxAge} años
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={`text-[11px] font-semibold block mb-1.5 ${mutedColor}`}>Mínimo</span>
                <Input
                  type="number"
                  min={18}
                  max={localFilters.maxAge}
                  value={localFilters.minAge}
                  onChange={(e) => setLocalFilters((prev) => ({ ...prev, minAge: Number(e.target.value) }))}
                  className="h-12 text-center font-mono text-[15px] font-bold rounded-[var(--radius-md)]"
                />
              </label>
              <label className="block">
                <span className={`text-[11px] font-semibold block mb-1.5 ${mutedColor}`}>Máximo</span>
                <Input
                  type="number"
                  min={localFilters.minAge}
                  max={65}
                  value={localFilters.maxAge}
                  onChange={(e) => setLocalFilters((prev) => ({ ...prev, maxAge: Number(e.target.value) }))}
                  className="h-12 text-center font-mono text-[15px] font-bold rounded-[var(--radius-md)]"
                />
              </label>
            </div>
          </section>

          {/* Toggles agrupados en una sola lista: menos bordes, misma función. */}
          <section>
            <p className={`${sectionTitle} mb-3`}>Solo mostrar</p>
            <div className={groupClass}>
              <label className={`${toggleRow} cursor-pointer`}>
                <span
                  className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${
                    isLight ? 'bg-[#ffe0ec]/70 text-[#ec4d86]' : 'bg-[#ec4d86]/15 text-[#ffa3c4]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13.5px] font-bold leading-tight ${titleColor}`}>Citas verificadas</span>
                  <span className={`block text-[11.5px] mt-0.5 leading-snug ${mutedColor}`}>
                    Miembros con al menos un encuentro real comprobado.
                  </span>
                </span>
                <Switch
                  checked={localFilters.onlyVerifiedMembers}
                  onCheckedChange={(checked) => {
                    sounds.playClick();
                    setLocalFilters((prev) => ({ ...prev, onlyVerifiedMembers: checked }));
                  }}
                />
              </label>

              <label className={`${toggleRow} cursor-pointer`}>
                <span
                  className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${
                    isLight ? 'bg-amber-500/12 text-amber-600' : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13.5px] font-bold leading-tight ${titleColor}`}>Con audio-bio</span>
                  <span className={`block text-[11.5px] mt-0.5 leading-snug ${mutedColor}`}>
                    Perfiles que se presentan con una nota de voz.
                  </span>
                </span>
                <Switch
                  checked={localFilters.withAudioBioOnly}
                  onCheckedChange={(checked) => {
                    sounds.playClick();
                    setLocalFilters((prev) => ({ ...prev, withAudioBioOnly: checked }));
                  }}
                />
              </label>
            </div>
          </section>

          {/* Interests Pills */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <Label className={sectionTitle + ' normal-case tracking-normal'}>Intereses en común</Label>
              {localFilters.selectedInterests.length > 0 && (
                <span className={valueBadge}>{localFilters.selectedInterests.length}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => {
                const isSelected = localFilters.selectedInterests.includes(interest.slug);
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.slug)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1 h-9 px-3.5 rounded-full border text-[12.5px] font-semibold transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] border-transparent text-white shadow-elevation-sm'
                        : isLight
                        ? 'bg-white border-[rgba(22,34,59,0.12)] text-[#16223b]'
                        : 'bg-white/6 border-white/10 text-[#f5f1e8]/85'
                    }`}
                  >
                    {isSelected && <span className="material-symbols-outlined text-[15px]">check</span>}
                    {interest.name}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-4 border-t flex items-center gap-3 shrink-0 ${
            isLight ? 'bg-white border-[#ffe0ec]' : 'bg-[#0f1a2e] border-white/8'
          }`}
        >
          <Button
            variant="tertiary"
            onClick={handleReset}
            className={`h-12 px-4 rounded-full text-[13px] font-bold ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}
          >
            Limpiar
          </Button>

          <Button variant="primary" onClick={handleApply} className="flex-1 h-12 rounded-full text-[14px] font-bold">
            Aplicar filtros
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
