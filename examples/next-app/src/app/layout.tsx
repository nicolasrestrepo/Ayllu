import './global.css';

import type { Metadata } from 'next';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'Ayllu Demo',
  description:
    'Vendor-agnostic logging pipeline showcasing batching, privacy, and offline persistence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
