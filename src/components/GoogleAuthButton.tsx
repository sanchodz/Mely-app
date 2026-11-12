import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { isNativeApp } from '../lib/platform';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

type GoogleCredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const finish = (ok: boolean) => {
        // Un rechazo quedaba cacheado para siempre: el reintento devolvía la
        // misma promesa rechazada aunque el script ya cargara después.
        if (ok && window.google?.accounts?.id) {
          resolve();
        } else {
          scriptPromise = null;
          reject(new Error('No se pudo cargar Google'));
        }
      };
      const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`) as HTMLScriptElement | null;
      if (existing) {
        // Si el tag ya existe pero su evento load se disparó antes (o falló en
        // silencio), los listeners nunca avisarían y la promesa colgaba eterna:
        // timeout de rescate que revalida el estado real.
        const fallback = window.setTimeout(() => finish(true), 8000);
        existing.addEventListener('load', () => { window.clearTimeout(fallback); finish(true); });
        existing.addEventListener('error', () => { window.clearTimeout(fallback); finish(false); });
        return;
      }
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** false si no hay client ID o si corre en la app nativa: sirve para no dejar un "o continuá con" huérfano. */
export const isGoogleAuthAvailable = (): boolean => Boolean(GOOGLE_CLIENT_ID) && !isNativeApp();

interface GoogleAuthButtonProps {
  onCredential: (idToken: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

/** Botón oficial "Sign in with Google" (Google Identity Services). No renderiza nada si no hay VITE_GOOGLE_CLIENT_ID configurado. */
export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ onCredential, text = 'continue_with' }) => {
  const { isLight } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || isNativeApp() || !containerRef.current) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: isLight ? 'outline' : 'filled_black',
          size: 'large',
          text,
          shape: 'pill',
          width: '320',
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLight, text]);

  // Google Identity Services no funciona dentro de un WebView (Google lo bloquea):
  // en la app nativa se oculta en vez de mostrar un botón que no hace nada.
  if (!GOOGLE_CLIENT_ID || failed || isNativeApp()) return null;

  // min-h reserva el alto del botón (40px de GIS) para que el formulario no salte al cargar.
  return <div ref={containerRef} className="w-full min-h-[44px] flex justify-center items-center [&>div]:w-full" />;
};
