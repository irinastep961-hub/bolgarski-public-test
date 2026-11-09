import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ProgressProvider } from '@/components/ProgressProvider';
import PwaRegister from '@/components/PwaRegister';
import TabBar from '@/components/TabBar';
import VoiceToast from '@/components/VoiceToast';

export const metadata: Metadata = {
  title: 'Болгарский без страха',
  description: 'Тренажёр для практики болгарского. Практикуйся. Повторяй. Начинай говорить',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Без страха', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#1b8bb0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ProgressProvider>
          {children}
          <TabBar />
          <VoiceToast />
        </ProgressProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
