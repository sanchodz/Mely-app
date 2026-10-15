import React from 'react';
import type { MembershipTier, ShopItem } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { cn } from '../../lib/utils';
import { planEndDate, planForKey, POWER_PRESENTATION, previousPlan } from './storeCatalog';
import { accentTile, Coins, Icon, Spinner, tone } from './storeUi';

interface PurchaseDialogProps {
  item: ShopItem | null;
  currentTier: MembershipTier;
  currentExpiresAt: string | null;
  balance: number;
  /** El ítem sale gratis por el cupo del plan actual. */
  includedInPlan: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  onGetCoins: () => void;
}

/**
 * Confirmación honesta: qué obtenés, cuánto sale y cómo queda tu saldo. Sin
 * contadores, sin "última oportunidad".
 */
export const PurchaseDialog: React.FC<PurchaseDialogProps> = ({
  item,
  currentTier,
  currentExpiresAt,
  balance,
  includedInPlan,
  pending,
  error,
  onConfirm,
  onClose,
  onGetCoins,
}) => {
  const plan = item ? planForKey(item.key) : undefined;
  const isRenewal = plan?.tier === currentTier;
  const cost = includedInPlan || !item ? 0 : item.price;
  const shortfall = Math.max(0, cost - balance);
  const icon = plan?.icon ?? (item ? POWER_PRESENTATION[item.key]?.icon : undefined) ?? 'shopping_bag';
  const accent = plan?.accent ?? (item ? POWER_PRESENTATION[item.key]?.accent : undefined) ?? 'coral';
  const prev = plan ? previousPlan(plan) : undefined;
  const endsOn = plan
    ? planEndDate(plan, currentTier, currentExpiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] p-0 gap-0 overflow-hidden">
        {item && (
          <>
            <div className="p-5 flex items-start gap-3">
              <div className={cn('w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center shrink-0', accentTile(accent))}>
                <Icon name={icon} filled className="text-[26px]" />
              </div>
              <div className="min-w-0 pr-6">
                <DialogTitle className={cn('text-[18px] font-bold leading-tight', tone.strong)}>
                  {isRenewal ? `Renovar ${item.name}` : item.name}
                </DialogTitle>
                <DialogDescription className={cn('text-[13px] mt-1 leading-snug', tone.muted)}>
                  {plan
                    ? isRenewal
                      ? `Se suman ${plan.durationDays} días a tu plan actual.`
                      : `Activo por ${plan.durationDays} días desde hoy. No se renueva solo.`
                    : item.description}
                </DialogDescription>
              </div>
            </div>

            {plan && (
              <div className="px-5 pb-4">
                <p className={cn('text-[12px] font-semibold uppercase tracking-[0.12em] mb-2', tone.muted)}>Qué obtenés</p>
                <ul className="flex flex-col gap-1.5">
                  {prev && (
                    <li className={cn('flex items-start gap-2 text-[13px]', tone.strong)}>
                      <Icon name="check" className="text-[16px] mt-px text-emerald-500 shrink-0" />
                      Todo lo de {prev.shortName}
                    </li>
                  )}
                  {plan.benefits.map((b) => (
                    <li key={b.title} className={cn('flex items-start gap-2 text-[13px]', tone.strong)}>
                      <Icon name="check" className="text-[16px] mt-px text-emerald-500 shrink-0" />
                      {b.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* El diálogo ya usa el canvas de fondo: el resumen va en blanco para despegarse. */}
            <dl className="mx-5 rounded-[var(--radius-md)] p-4 flex flex-col gap-2 text-[13px] bg-white dark:bg-[var(--midnight-950)]">
              <div className="flex justify-between gap-3">
                <dt className={tone.muted}>Precio</dt>
                <dd className={cn('font-bold', includedInPlan ? 'text-emerald-600 dark:text-emerald-400' : tone.strong)}>
                  {includedInPlan ? 'Incluido en tu plan' : <Coins amount={item.price} />}
                </dd>
              </div>
              {endsOn && (
                <div className="flex justify-between gap-3">
                  <dt className={tone.muted}>{isRenewal ? 'Nuevo vencimiento' : 'Vence el'}</dt>
                  <dd className={cn('font-semibold text-right', tone.strong)}>{endsOn}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className={tone.muted}>Tu saldo</dt>
                <dd className={tone.strong}>
                  <Coins amount={balance} />
                </dd>
              </div>
              {!includedInPlan && (
                <div className={cn('flex justify-between gap-3 pt-2 border-t', tone.divider)}>
                  <dt className={cn('font-semibold', tone.strong)}>{shortfall > 0 ? 'Te faltan' : 'Te quedan'}</dt>
                  <dd className={cn('font-bold', shortfall > 0 ? tone.accent : tone.strong)}>
                    {shortfall > 0 ? <Coins amount={shortfall} /> : <Coins amount={balance - cost} />}
                  </dd>
                </div>
              )}
            </dl>

            {error && (
              <p role="alert" className={cn('mx-5 mt-3 text-[13px] font-semibold', tone.accent)}>
                {error}
              </p>
            )}

            <div className="p-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onClose} disabled={pending} className="rounded-[var(--radius-pill)]">
                Cancelar
              </Button>
              {shortfall > 0 ? (
                <Button onClick={onGetCoins} className="rounded-[var(--radius-pill)] gap-1">
                  Conseguir coins
                </Button>
              ) : (
                <Button onClick={onConfirm} disabled={pending} aria-busy={pending} className="rounded-[var(--radius-pill)] gap-1.5">
                  {pending && <Spinner className="text-[16px]" />}
                  {pending ? 'Procesando…' : includedInPlan ? 'Usar ahora' : 'Confirmar'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** Qué pasó y, si tiene sentido, adónde ir a usarlo. */
export interface Receipt {
  title: string;
  detail: string;
  action?: { label: string; icon: string; onClick: () => void };
}

export const ReceiptDialog: React.FC<{ receipt: Receipt | null; onClose: () => void }> = ({ receipt, onClose }) => (
  <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="w-[calc(100%-2rem)] max-w-[380px] text-center flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--coral-600)] to-[var(--coral-500)] flex items-center justify-center text-white shadow-[var(--shadow-coral)]">
        <Icon name="verified" filled className="text-[34px]" />
      </div>
      <div>
        <span className="section-kicker block">Listo</span>
        <DialogTitle className={cn('text-[19px] font-bold mt-2', tone.strong)}>{receipt?.title}</DialogTitle>
        <DialogDescription className={cn('text-[13px] mt-1', tone.muted)}>{receipt?.detail}</DialogDescription>
      </div>
      <div className="w-full flex flex-col gap-2">
        {receipt?.action && (
          <Button onClick={receipt.action.onClick} className="w-full rounded-[var(--radius-pill)] gap-1.5">
            {receipt.action.label}
            <Icon name={receipt.action.icon} className="text-[18px]" />
          </Button>
        )}
        <Button variant={receipt?.action ? 'secondary' : 'primary'} onClick={onClose} className="w-full rounded-[var(--radius-pill)]">
          {receipt?.action ? 'Seguir en la tienda' : 'Continuar'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);
