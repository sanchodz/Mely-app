import React, { useState } from 'react';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useDeleteNotification,
  useDeleteAllNotifications,
} from '../hooks/useNotifications';
import type { AppNotification } from '../lib/api/notifications';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Dialog, DialogContent } from './ui/dialog';

const CATEGORY_ICONS: Record<string, string> = {
  match: 'favorite',
  date_proposal: 'event',
  date_accepted: 'event_available',
  date_reminder: 'alarm',
  check_in: 'qr_code_2',
  coins: 'monetization_on',
  person_of_the_day: 'star',
  stamps: 'workspace_premium',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `Hace ${hs} h`;
  const days = Math.floor(hs / 24);
  if (days < 7) return `Hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

interface NotificationBellProps {
  onNavigate: (category?: string, data?: Record<string, unknown>) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { isLight } = useTheme();
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteOne = useDeleteNotification();
  const deleteAll = useDeleteAllNotifications();
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleItemClick = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    onNavigate(n.category, n.data);
  };

  return (
    <>
      <Button
        id="top-notifications-btn"
        variant="secondary"
        size="icon"
        onClick={() => {
          sounds.playClick();
          setOpen(true);
        }}
        className={`relative h-9 w-9 rounded-full active:scale-95 transition-all duration-200 shadow-elevation-sm hover:shadow-elevation-md ${
          isLight
            ? 'bg-white text-[#16223b] border-[#ffe0ec] hover:border-[#ec4d86]'
            : 'bg-[#131f36] text-[#f5f1e8] hover:text-[#ffa3c4] border-white/10'
        }`}
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ec4d86] text-white text-[10px] font-bold flex items-center justify-center ring-2 ${isLight ? 'ring-[#fcf9f2]' : 'ring-[#0a1120]'}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0">
          <SheetHeader
            // pr-12 en vez de p-4 parejo: el botón "X" para cerrar del Sheet se dibuja
            // absoluto en la esquina (right-4 top-4, ~28px de ancho) — sin este padding
            // extra, "Marcar todo leído" quedaba flush a la derecha y se superponía con la X.
            className={`p-4 pr-12 border-b flex-row items-center justify-between space-y-0 shrink-0 ${
              isLight ? 'border-slate-100' : 'border-white/10'
            }`}
          >
            <SheetTitle className="text-[18px] font-bold">Notificaciones</SheetTitle>
            <div className="flex items-center gap-0.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    markAllRead.mutate();
                  }}
                  className="h-9 px-2.5 rounded-full text-[13px] font-bold text-[#ec4d86] hover:bg-[#ec4d86]/8 cursor-pointer"
                >
                  Marcar leídas
                </button>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setShowDeleteAllConfirm(true);
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isLight ? 'text-[#5b6478] hover:text-[#ec4d86] hover:bg-[#fcf9f2]' : 'text-[#a9b2c9] hover:text-[#ffa3c4] hover:bg-white/8'
                  }`}
                  aria-label="Eliminar todas las notificaciones"
                  title="Eliminar todas las notificaciones"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
                <span className={`w-16 h-16 rounded-full flex items-center justify-center ${isLight ? 'bg-[#fcf9f2]' : 'bg-white/5'}`}>
                  <span className={`material-symbols-outlined text-[32px] ${isLight ? 'text-[#5b6478]/60' : 'text-white/30'}`}>
                    notifications_none
                  </span>
                </span>
                <p className={`text-[15px] font-bold ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>Todo al día</p>
                <p className={`text-[13px] -mt-1.5 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                  Todavía no tenés notificaciones.
                </p>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`group relative w-full flex items-start gap-2 pl-4 pr-2 py-3.5 border-b transition-colors ${
                    isLight ? 'border-[#16223b]/6 hover:bg-[#fcf9f2]' : 'border-white/6 hover:bg-white/4'
                  } ${!n.readAt ? (isLight ? 'bg-[#ec4d86]/4' : 'bg-[#ec4d86]/6') : ''}`}
                >
                  <button type="button" onClick={() => handleItemClick(n)} className="flex-1 min-w-0 flex items-start gap-3 text-left cursor-pointer">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${!n.readAt ? 'bg-gradient-to-tr from-[#ec4d86] to-[#ff6b9e] text-white' : isLight ? 'bg-[#efe7d8] text-[#5b6478]' : 'bg-white/8 text-[#a9b2c9]'}`}>
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: !n.readAt ? "'FILL' 1" : "'FILL' 0" }}>
                        {CATEGORY_ICONS[n.category] ?? 'notifications'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[14px] leading-tight truncate ${!n.readAt ? 'font-bold' : 'font-semibold'} ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>
                          {n.title}
                        </span>
                        <span className={`text-[11px] shrink-0 ${!n.readAt ? 'text-[#ec4d86] font-semibold' : isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className={`text-[13px] mt-1 leading-snug line-clamp-2 ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
                        {n.body}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      deleteOne.mutate(n.id);
                    }}
                    className={`shrink-0 w-9 h-9 -mt-1 rounded-full flex items-center justify-center transition-colors ${
                      isLight ? 'text-[#5b6478]/60 hover:text-[#ec4d86] hover:bg-[#efe7d8]' : 'text-white/30 hover:text-[#ffa3c4] hover:bg-white/10'
                    }`}
                    aria-label="Eliminar notificación"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[360px] p-6 text-center">
          <span className="mx-auto w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">delete</span>
          </span>
          <h3 className={`text-[18px] font-bold leading-tight ${isLight ? 'text-[#16223b]' : 'text-[#f5f1e8]'}`}>¿Eliminar todas las notificaciones?</h3>
          <p className={`text-[13.5px] ${isLight ? 'text-[#5b6478]' : 'text-[#a9b2c9]'}`}>
            No se puede deshacer.
          </p>
          <div className="flex gap-2.5">
            <Button type="button" variant="tertiary" onClick={() => setShowDeleteAllConfirm(false)} className="flex-1 h-11 rounded-2xl text-[14px] font-bold">
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                deleteAll.mutate();
                setShowDeleteAllConfirm(false);
              }}
              disabled={deleteAll.isPending}
              className="flex-1 h-11 rounded-2xl text-[14px] font-bold"
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
