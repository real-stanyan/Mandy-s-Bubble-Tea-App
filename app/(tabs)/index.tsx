// app/(tabs)/index.tsx
import { GrainGround } from '@/components/ui/GrainOverlay';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader } from '@/components/home/HomeHeader';
import { PublicHolidayBanner } from '@/components/home/PublicHolidayBanner';
import { OrderInProgress } from '@/components/home/OrderInProgress';
import { OrderAgain } from '@/components/home/OrderAgain';
import { HomeLoyaltyHero } from '@/components/home/HomeLoyaltyHero';
import { ThisWeek } from '@/components/home/ThisWeek';
import { OffersCarousel } from '@/components/home/OffersCarousel';
import { CategoriesGrid } from '@/components/home/CategoriesGrid';
import { StoreCard } from '@/components/home/StoreCard';
import { T } from '@/constants/theme';
import { Reveal } from '@/components/ui/Reveal';

// Home is the counter (direction A, Stan 2026-09-06): what a regular does
// when they walk in, in that order — see the store is open and how long the
// wait is, check on the cup being made, order the usual again, see what's
// on this week, the rewards strip, the offers, browse, and the store itself.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: insets.top }}>
      <GrainGround />
      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        <PublicHolidayBanner />
        <Reveal index={0}><HomeHeader /></Reveal>
        <Reveal index={1}><OrderInProgress /></Reveal>
        <Reveal index={1}><OrderAgain /></Reveal>
        <Reveal index={2}><HomeLoyaltyHero /></Reveal>
        <Reveal index={3}><ThisWeek /></Reveal>
        <Reveal index={4}><OffersCarousel /></Reveal>
        <Reveal index={5}><CategoriesGrid /></Reveal>
        <Reveal index={6}><StoreCard /></Reveal>
      </ScrollView>
    </View>
  );
}
