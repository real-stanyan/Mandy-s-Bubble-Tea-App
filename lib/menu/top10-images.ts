// Static require() map for TOP-10-only product photos. React Native's bundler
// needs literal require paths, so each override image is listed explicitly and
// keyed by the same slug used in top10-presets.ts (`image` field). Mirrors the
// web counterpart at public/image/top10/<slug>.webp.

import type { ImageSourcePropType } from 'react-native'

export const TOP10_IMAGE_SOURCES: Record<string, ImageSourcePropType> = {
  'brown-sugar-milk-tea': require('../../assets/menu/top10/brown-sugar-milk-tea.webp'),
  'chocolate-frappe': require('../../assets/menu/top10/chocolate-frappe.webp'),
  'lychee-iced-green-tea': require('../../assets/menu/top10/lychee-iced-green-tea.webp'),
  'mango-slushy': require('../../assets/menu/top10/mango-slushy.webp'),
  'original-milk-tea': require('../../assets/menu/top10/original-milk-tea.webp'),
  'red-dragon-fruit-slushy': require('../../assets/menu/top10/red-dragon-fruit-slushy.webp'),
  'taro-milk-tea': require('../../assets/menu/top10/taro-milk-tea.webp'),
}
