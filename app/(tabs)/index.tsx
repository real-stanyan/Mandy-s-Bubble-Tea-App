// app/(tabs)/index.tsx
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader } from '@/components/home/HomeHeader';
import { PublicHolidayBanner } from '@/components/home/PublicHolidayBanner';
import { HomeLoyaltyHero } from '@/components/home/HomeLoyaltyHero';
import {
  AppDownloadDiscountCard,
  useAppDownloadStatus,
} from '@/components/account/AppDownloadDiscountCard';
import {
  TastingPromoCard,
  useTastingPromoStatus,
} from '@/components/account/TastingPromoCard';
import { YourUsual } from '@/components/home/YourUsual';
import { DailySpecial } from '@/components/home/DailySpecial';
import { FragranceBlindBox } from '@/components/home/FragranceBlindBox';
import { CategoriesStrip } from '@/components/home/CategoriesStrip';
import { StoreCard } from '@/components/home/StoreCard';
import { T } from '@/constants/theme';
import { Reveal } from '@/components/ui/Reveal';
import { FRAGRANCE_BLIND_BOX_PROMO } from '@/lib/constants';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const appDownloadStatus = useAppDownloadStatus();
  const tastingStatus = useTastingPromoStatus();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top }}>
      <ScrollView
        style={{ backgroundColor: T.bg }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        <PublicHolidayBanner />
        <Reveal index={0}><HomeHeader /></Reveal>
        {FRAGRANCE_BLIND_BOX_PROMO && <FragranceBlindBox />}
        <Reveal index={1}><HomeLoyaltyHero /></Reveal>
        {/* Above the app-download gift: a live tasting window is the more
            perishable of the two, and the one the push is driving traffic to. */}
        <Reveal index={2}><TastingPromoCard status={tastingStatus} /></Reveal>
        <Reveal index={2}><AppDownloadDiscountCard status={appDownloadStatus} /></Reveal>
        <Reveal index={3}><YourUsual /></Reveal>
        <Reveal index={4}><DailySpecial /></Reveal>
        <Reveal index={5}><CategoriesStrip /></Reveal>
        <Reveal index={6}><StoreCard /></Reveal>
      </ScrollView>
    </View>
  );
}
