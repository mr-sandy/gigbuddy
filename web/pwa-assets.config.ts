import {
  defaultAssetName,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

// Fill behind the icon's rounded corners and padding with the icon's own
// background, not the generator's default white.
const ICON_BACKGROUND = '#1a1209';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // The source already has its own margin around the keys.
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    // iOS applies its own corner mask and shows transparency as black, so
    // flatten to a full square.
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: ICON_BACKGROUND },
    },
    // Android crops to the central 80% circle; 0.2 keeps the keys inside it.
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.2,
      resizeOptions: { background: ICON_BACKGROUND },
    },
    assetName: (type, size) => `icons/${defaultAssetName(type, size)}`,
  },
  images: ['public/icon-source.svg'],
});
