import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import QrScanner from 'qr-scanner';
import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url';
import { motion } from 'motion/react';
import { PlanType } from '../types';
import { sounds } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';
import { useConfirmDate, useCurrentDateMeet, useGenerateQr, useScanCheckIn } from '../hooks/useDates';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { ProfilePhoto } from './ProfilePhoto';

QrScanner.WORKER_PATH = QrScannerWorkerPath;

type Coords = { latitude: number; longitude: number };

/**
 * FINDY verifica encuentros presenciales comparando la ubicación de quien genera el QR
 * contra la de quien lo escanea (ver dates/service.ts scanQr). Sin esto ambos pasos
 * eran puro trámite: nadie chequeaba que estuvieran realmente en el mismo lugar.
 */
function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no soporta geolocalización.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Activá el permiso de ubicación para generar o escanear el código.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('No pudimos obtener tu ubicación a tiempo. Probá de nuevo.'));
        } else {
          reject(new Error('No pudimos obtener tu ubicación. Probá de nuevo.'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

const PLAN_LABELS: Record<PlanType, string> = {
  COFFEE: 'Café',
  FOOD: 'Comida',
  BAR: 'Tragos',
  CINEMA: 'Cine',
  ACTIVITY: 'Actividad',
  CHILL: 'Plan tranqui',
  OTHER: 'Plan',
};

interface DateQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string | null;
  partnerName: string;
  partnerAvatar: string;
}

export const DateQRModal: React.FC<DateQRModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  partnerName,
  partnerAvatar,
}) => {
  const { isLight } = useTheme();
  const [mode, setMode] = useState<'show_qr' | 'scan_manual'>('show_qr');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  const { data: dateMeet } = useCurrentDateMeet(isOpen ? connectionId : null);
  const dateId = dateMeet?.id ?? null;
  const zone = dateMeet?.zone ?? '';
  const planType = (dateMeet?.planType ?? 'OTHER') as PlanType;
  const status = dateMeet?.status ?? '';

  const generateQr = useGenerateQr();
  const scanCheckIn = useScanCheckIn();
  const confirmDate = useConfirmDate();

  const startQrGeneration = (targetDateId: string) => {
    setLocationError(null);
    setQrDataUrl(null);
    getCurrentCoords()
      .then((coords) => {
        generateQr.mutate(
          { dateId: targetDateId, coords },
          {
            onSuccess: async (res) => {
              setQrDataUrl(await QRCode.toDataURL(res.payload, { margin: 1, width: 220, color: { dark: '#16223b' } }));
            },
            onError: (err: any) => {
              setLocationError(err?.message ?? 'No pudimos generar el código. Probá de nuevo.');
            },
          },
        );
      })
      .catch((err: Error) => setLocationError(err.message));
  };

  useEffect(() => {
    if (!isOpen || !dateId) return;
    setMode('show_qr');
    setManualCode('');
    setUseManualEntry(false);
    setCameraError(null);
    setScanError(null);
    setLocationError(null);
    setVerificationSuccess(status === 'VERIFIED');
    setCoinsEarned(0);
    if (status === 'CANCELLED' || status === 'VERIFIED') return;
    startQrGeneration(dateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dateId, status]);

  const submitCode = (code: string) => {
    if (!dateId || !code.trim() || scanCheckIn.isPending) return;
    setScanError(null);
    scannerRef.current?.pause();
    getCurrentCoords()
      .then((coords) => {
        scanCheckIn.mutate(
          { dateId, code: code.trim(), coords },
          {
            onSuccess: () => {
              sounds.playScanBeep();
              setManualCode('');
            },
            onError: (err: any) => {
              setScanError(err?.message ?? 'Código inválido');
              scannerRef.current?.start().catch(() => undefined);
            },
          },
        );
      })
      .catch((err: Error) => {
        setScanError(err.message);
        scannerRef.current?.start().catch(() => undefined);
      });
  };

  // Escaneo real con cámara: apuntás al QR de tu pareja en vez de tener que pasarte el código
  // por texto, que era lo que permitía el ingreso manual como único camino.
  useEffect(() => {
    if (!isOpen || mode !== 'scan_manual' || useManualEntry || !videoRef.current) return;
    let cancelled = false;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const text = typeof result === 'string' ? result : result.data;
        try {
          const parsed = JSON.parse(text) as { dateId?: string; code?: string };
          if (!parsed.code) throw new Error('sin código');
          if (parsed.dateId && parsed.dateId !== dateId) {
            setScanError('Ese QR es de otra cita.');
            return;
          }
          submitCode(parsed.code);
        } catch {
          setScanError('QR no reconocido. Probá de nuevo o ingresá el código a mano.');
        }
      },
      { highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: 'environment' },
    );
    scannerRef.current = scanner;
    scanner.start().catch(() => {
      if (!cancelled) setCameraError('No se pudo acceder a la cámara. Revisá los permisos o ingresá el código a mano.');
    });
    return () => {
      cancelled = true;
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, useManualEntry, dateId]);

  if (!isOpen || !connectionId || !dateId) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    submitCode(manualCode);
  };

  const handleConfirm = (sawEachOther: boolean) => {
    sounds.playClick();
    confirmDate.mutate(
      { dateId, sawEachOther },
      {
        onSuccess: (res) => {
          if (res.verified) {
            sounds.playVerified();
            setCoinsEarned(res.coinsEarned);
            setVerificationSuccess(true);
          }
        },
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-[400px] p-0 gap-0 overflow-hidden">
        {/* Top Header */}
        <DialogHeader className={`p-4 pr-14 border-b flex-row items-center shrink-0 space-y-0 ${isLight ? 'bg-white border-[var(--color-line)]' : 'bg-[var(--midnight-900)] border-[var(--hairline)]'}`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full p-[2px] shrink-0" style={{ background: 'linear-gradient(135deg, var(--coral-600), var(--coral-300))' }}>
              <div className="w-full h-full rounded-full overflow-hidden">
                <ProfilePhoto url={partnerAvatar || null} name={partnerName} className="w-full h-full" fallbackClassName="text-[12px]" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="section-kicker block">Pase de cita presencial</span>
              <h3 className={`text-[20px] italic font-semibold leading-tight mt-1 truncate ${isLight ? 'text-[var(--text-on-light)]' : 'text-[var(--text-primary)]'}`} style={{ fontFamily: 'var(--font-display)' }}>
                Cita con {partnerName}
              </h3>
            </div>
          </div>
        </DialogHeader>

        {!verificationSuccess && (
          <div
            className={`p-2 flex gap-1 border-b ${isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[var(--midnight-950)] border-[var(--hairline)]'}`}
          >
            <button
              onClick={() => {
                sounds.playClick();
                setMode('show_qr');
              }}
              className={`flex-1 h-11 rounded-full text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'show_qr'
                  ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white shadow-elevation-sm'
                  : isLight
                  ? 'text-[var(--text-on-light-muted)] hover:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
              <span>Mi pase QR</span>
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setMode('scan_manual');
              }}
              className={`flex-1 h-11 rounded-full text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'scan_manual'
                  ? 'bg-gradient-to-r from-[#ec4d86] to-[#ff6b9e] text-white shadow-elevation-sm'
                  : isLight
                  ? 'text-[var(--text-on-light-muted)] hover:bg-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">document_scanner</span>
              <span className="truncate">Escanear a {partnerName}</span>
            </button>
          </div>
        )}

        {/* Mode 1: SHOW QR */}
        {mode === 'show_qr' && !verificationSuccess && (
          <div className="p-5 flex flex-col items-center gap-4 text-center">
            <div
              className={`p-4 rounded-[var(--radius-lg)] border-2 border-dashed relative ${
                isLight ? 'bg-[var(--color-canvas)] border-[var(--coral-300)]/60' : 'bg-[var(--midnight-950)] border-[var(--coral-500)]/40'
              }`}
            >
              <div className="w-[220px] h-[220px] bg-white p-2 rounded-[var(--radius-md)] flex items-center justify-center shadow-elevation-md overflow-hidden">
                {locationError ? (
                  <div className="flex flex-col items-center gap-2 px-3 text-center">
                    <span className="material-symbols-outlined text-[32px] text-[#ec4d86]">location_off</span>
                    <p className="text-[11px] text-[#ec4d86] font-bold leading-snug">{locationError}</p>
                  </div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="Código QR de la cita" className="w-full h-full object-contain" />
                ) : (
                  <span
                    className={`material-symbols-outlined text-[48px] animate-pulse ${
                      isLight ? 'text-[#ffe0ec]' : 'text-[#ec4d86]/30'
                    }`}
                  >
                    qr_code_2
                  </span>
                )}
              </div>
              {locationError && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    sounds.playClick();
                    if (dateId) startQrGeneration(dateId);
                  }}
                  className="w-full h-11 mt-3 rounded-full gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  <span>Reintentar</span>
                </Button>
              )}
              <div className="mt-3">
                <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-tertiary)]'}`}>
                  {PLAN_LABELS[planType]} en {zone}
                </span>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-[var(--radius-md)] border text-left flex items-start gap-3 w-full ${
                isLight ? 'bg-[var(--color-canvas)] border-[var(--color-line)]' : 'bg-[var(--midnight-950)] border-[var(--hairline)]'
              }`}
            >
              <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isLight ? 'bg-[var(--coral-100)] text-[var(--coral-700)]' : 'bg-[var(--coral-500)]/15 text-[var(--coral-300)]'}`}>
                <span className="material-symbols-outlined text-[19px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </span>
              <div className="min-w-0">
                <h4 className={`text-[14px] font-bold leading-snug ${isLight ? 'text-[var(--text-on-light)]' : 'text-[var(--text-primary)]'}`}>
                  Encuentro seguro en persona
                </h4>
                <p className={`text-[12.5px] mt-1 leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                  Mostrale este código a {partnerName}, que lo ingrese desde su celular. Usamos tu ubicación (no se guarda en tu perfil) para confirmar que están en el mismo lugar.
                </p>
              </div>
            </div>

            {status === 'CHECKED_IN' && (
              <div className={`w-full flex flex-col gap-3 p-4 rounded-[var(--radius-md)] border ${isLight ? 'bg-[var(--success-100)] border-[#7fbfa0]/40' : 'bg-[#3f7a5c]/25 border-[#3f7a5c]/40'}`}>
                <p className={`text-[14px] font-bold ${isLight ? 'text-[#3f7a5c]' : 'text-[#7fbfa0]'}`}>
                  Check-in listo. ¿Se vieron en persona?
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    onClick={() => handleConfirm(true)}
                    disabled={confirmDate.isPending}
                    className="h-11 bg-gradient-to-r from-[#3f7a5c] to-[#7fbfa0] text-white text-[14px] font-bold rounded-full shadow-none"
                  >
                    Sí, nos vimos
                  </Button>
                  <Button
                    onClick={() => handleConfirm(false)}
                    disabled={confirmDate.isPending}
                    variant="secondary"
                    className="h-11 text-[14px] font-bold rounded-full"
                  >
                    No pasó
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode 2: CAMERA SCAN (con fallback manual) */}
        {mode === 'scan_manual' && !verificationSuccess && (
          <div className="p-5 flex flex-col items-center gap-4 text-center">
            {!useManualEntry ? (
              <>
                <p className={`text-[13.5px] leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                  Apuntá la cámara al QR que {partnerName} te muestra en su pantalla.
                </p>
                <div className="w-full aspect-square rounded-[var(--radius-lg)] overflow-hidden bg-black relative border-2 border-dashed border-[#ec4d86]/40">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 bg-black/85 text-center">
                      <span className="material-symbols-outlined text-[32px] text-[#ffa3c4]">videocam_off</span>
                      <p className="text-[13px] text-white/90 leading-snug">{cameraError}</p>
                    </div>
                  )}
                </div>
                {scanError && <p className="text-[13px] text-[#ec4d86] font-bold">{scanError}</p>}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setUseManualEntry(true);
                    setCameraError(null);
                    setScanError(null);
                  }}
                  className={`min-h-11 px-3 text-[13px] font-bold underline underline-offset-4 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}
                >
                  No puedo usar la cámara, ingresar código a mano
                </button>
              </>
            ) : (
              <form onSubmit={handleManualSubmit} className="w-full flex flex-col items-center gap-4">
                <span className={`w-16 h-16 rounded-full flex items-center justify-center ${isLight ? 'bg-[var(--coral-100)] text-[var(--coral-700)]' : 'bg-[var(--coral-500)]/15 text-[var(--coral-300)]'}`}>
                  <span className="material-symbols-outlined text-[34px]">pin</span>
                </span>
                <p className={`text-[13.5px] leading-snug ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                  Pedile a {partnerName} que te muestre su pase y escribí el código de 6 dígitos.
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoFocus
                  className="text-center font-mono tracking-[0.4em] text-[24px] h-14"
                />
                {scanError && <p className="text-[13px] text-[#ec4d86] font-bold">{scanError}</p>}
                <Button
                  type="submit"
                  disabled={scanCheckIn.isPending}
                  className="w-full h-12 rounded-full text-[15px] disabled:opacity-60"
                >
                  Validar código
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setUseManualEntry(false);
                    setScanError(null);
                  }}
                  className={`min-h-11 px-3 text-[13px] font-bold underline underline-offset-4 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}
                >
                  Volver a usar la cámara
                </button>
              </form>
            )}
          </div>
        )}

        {/* State: VERIFICATION SUCCESS */}
        {verificationSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 flex flex-col items-center gap-4 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#3f7a5c] to-[#7fbfa0] flex items-center justify-center text-white shadow-xl shadow-[#3f7a5c]/30">
              <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-[0.14em] text-[#3f7a5c] dark:text-[#7fbfa0] font-extrabold block">
                Encuentro verificado
              </span>
              <h3 className={`text-[24px] italic font-semibold leading-tight mt-2 ${isLight ? 'text-[var(--text-on-light)]' : 'text-[var(--text-primary)]'}`} style={{ fontFamily: 'var(--font-display)' }}>
                Cita presencial confirmada
              </h3>
              <p className={`text-[13.5px] leading-snug mt-1.5 ${isLight ? 'text-[var(--text-on-light-muted)]' : 'text-[var(--text-secondary)]'}`}>
                El sello de {PLAN_LABELS[planType]} en {zone} se estampó en tu pasaporte FINDY.
              </p>
            </div>
            {coinsEarned > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 340, damping: 20 }}
                onAnimationStart={() => window.setTimeout(() => sounds.playCoins(), 250)}
                className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 h-10 border ${
                  isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-400/30'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[18px] text-amber-500"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  monetization_on
                </span>
                <span className={`text-[15px] font-bold tabular-nums ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                  +{coinsEarned} monedas
                </span>
              </motion.div>
            )}
            <Button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="w-full h-12 rounded-full text-[15px]"
            >
              Listo, volver al itinerario
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};
