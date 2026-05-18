import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { guestFetch } from '../api/client';
import type { GuestMeResponse } from '../api/types';

export type BrandingValue = {
  token: string;
  roomName: string;
  roomNameEn: string;
  roomNameTc: string;
  roomNameSc: string;
  siteName: string;
  primaryColour: string;
  welcomeEn: string;
  welcomeTc: string;
  welcomeSc: string;
  wifiSsid: string | null;
  loaded: boolean;
};

const BrandingContext = createContext<BrandingValue | null>(null);

export function BrandingProvider({ children, token }: { children: ReactNode; token: string }) {
  const [branding, setBranding] = useState<BrandingValue | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      try {
        const data = await guestFetch<GuestMeResponse>('/me', {}, token);
        if (cancelled) {
          return;
        }

        const primaryColour = data.branding?.primaryColour?.trim() || '#00845C';
        const nextBranding: BrandingValue = {
          token,
          roomName: data.room.nameEn || data.room.name,
          roomNameEn: data.room.nameEn || data.room.name,
          roomNameTc: data.room.nameTc || data.room.name,
          roomNameSc: data.room.nameSc || data.room.name,
          siteName: data.site.name,
          primaryColour,
          welcomeEn: data.branding?.welcomeEn || '',
          welcomeTc: data.branding?.welcomeTc || '',
          welcomeSc: data.branding?.welcomeSc || '',
          wifiSsid: data.branding?.wifiSsid || null,
          loaded: true,
        };

        setBranding(nextBranding);
        const rgb = hexToRgb(primaryColour);
        document.documentElement.style.setProperty('--color-primary', `${rgb.r} ${rgb.g} ${rgb.b}`);
      } catch (error) {
        console.error('Failed to load branding:', error);
      }
    }

    void loadBranding();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(() => branding, [branding]);

  if (!value) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return ctx;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const value = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized.padEnd(6, '0').slice(0, 6);

  const parts = value.match(/.{2}/g) || ['00', '84', '5c'];
  return {
    r: Number.parseInt(parts[0], 16),
    g: Number.parseInt(parts[1], 16),
    b: Number.parseInt(parts[2], 16),
  };
}
