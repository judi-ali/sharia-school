import { IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic } from 'next/font/google';

export const body = IBM_Plex_Sans_Arabic({
  weight: ['400', '500', '600', '700'], subsets: ['arabic', 'latin'], variable: '--font-body',
});
export const display = Noto_Kufi_Arabic({
  weight: ['500', '700'], subsets: ['arabic'], variable: '--font-display',
});
