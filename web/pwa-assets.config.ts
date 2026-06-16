import {
  defaultAssetName,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    assetName: (type, size) => `icons/${defaultAssetName(type, size)}`,
  },
  images: ['public/icon-source.svg'],
});
