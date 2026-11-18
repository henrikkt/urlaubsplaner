import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Erzeugt die App-Icons aus public/favicon.svg:  npx pwa-assets-generator
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.12, resizeOptions: { background: '#FF8A5B' } },
    apple: { ...minimal2023Preset.apple, padding: 0.12, resizeOptions: { background: '#FF8A5B' } },
  },
  images: ['public/favicon.svg'],
});
