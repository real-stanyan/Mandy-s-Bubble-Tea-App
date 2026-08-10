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
        <HomeHeader />
        {FRAGRANCE_BLIND_BOX_PROMO && <FragranceBlindBox />}
        <HomeLoyaltyHero />
        {/* Above the app-download gift: a live tasting window is the more
            perishable of the two, and the one the push is driving traffic to. */}
        <TastingPromoCard status={tastingStatus} />
        <AppDownloadDiscountCard status={appDownloadStatus} />
        <YourUsual />
        <DailySpecial />
        <CategoriesStrip />
        <StoreCard />
      </ScrollView>
    </View>
  );
}
