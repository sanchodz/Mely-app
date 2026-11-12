import React from 'react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useInactiveMatches, useReactivateMatch } from '../hooks/useMatches';
import { usePerks, useShop } from '../hooks/useShop';
import { sounds } from '../utils/audio';
import { ProfilePhoto } from './ProfilePhoto';
import { Button } from './ui/button';

interface InactiveMatchesSectionProps {
  onOpenChat: (connectionId: string) => void;
}

/**
 * Matches que se enfriaron porque nadie escribió a tiempo. Antes el backend no los
 * listaba, así que "Reactivar match" se vendía en la Tienda sin ningún lugar desde
 * donde usarlo. Gold y Black traen reactivaciones incluidas; el resto paga en coins.
 */
export const InactiveMatchesSection: React.FC<InactiveMatchesSectionProps> = ({ onOpenChat }) => {
  const { isLight } = useTheme();
  const { data: inactive = [] } = useInactiveMatches();
  const { data: perks } = usePerks();
  const { data: shopItems = [] } = useShop();
  const reactivate = useReactivateMatch();

  if (inactive.length === 0) return null;

  const price = shopItems.find((i) => i.key === 'REACTIVATE_MATCH')?.price;
  const perk = perks?.items.find((i) => i.itemKey === 'REACTIVATE_MATCH');
  const includedLeft = perk ? (perk.unlimited ? Infinity : perk.remaining ?? 0) : 0;
  const costLabel = includedLeft > 0 ? 'Incluido en tu plan' : price != null ? `${price} coins` : 'Reactivar';

  const handleReactivate = (connectionId: string, name: string) => {
    if (reactivate.isPending) return;
    sounds.playCoins();
    reactivate.mutate(connectionId, {
      onSuccess: (res) => {
        toast.success(res.includedInPlan ? `Volviste a conectar con ${name} (incluido en tu plan).` : `Volviste a conectar con ${name}.`);
        onOpenChat(connectionId);
      },
      onError: (err: any) => toast.error(err?.message ?? 'No se pudo reactivar el match'),
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
            Se enfriaron
          </p>
          <h3 className={`text-[18px] font-bold leading-tight mt-0.5 ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
            {inactive.length} {inactive.length === 1 ? 'match sin respuesta' : 'matches sin respuesta'}
          </h3>
        </div>
        <span className={`text-[12px] shrink-0 text-right ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
          {includedLeft === Infinity
            ? 'Incluido en tu plan'
            : includedLeft > 0
              ? `${includedLeft} incluida${includedLeft === 1 ? '' : 's'}`
              : 'Nadie escribió a tiempo'}
        </span>
      </div>
      <div
        className={`rounded-2xl divide-y overflow-hidden ${
          isLight ? 'bg-white shadow-elevation-sm divide-[#16223b]/6' : 'bg-[#131f36] divide-white/6'
        }`}
      >
        {inactive.map((match) => (
          <div key={match.id} className="pl-3 pr-3 py-3 flex items-center gap-3">
            <ProfilePhoto
              url={match.other.photos[0]?.url}
              name={match.other.displayName}
              className="w-12 h-12 rounded-2xl grayscale opacity-80"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-[15px] font-bold leading-tight truncate ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                {match.other.displayName}
              </p>
              <p className={`text-[12px] mt-0.5 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>{costLabel}</p>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={reactivate.isPending}
              onClick={() => handleReactivate(match.id, match.other.displayName)}
              className="h-10 px-4 rounded-full text-[13px] font-bold shrink-0 gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
              Reactivar
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};
