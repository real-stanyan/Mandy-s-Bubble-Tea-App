// app/(tabs)/index.tsx
import { GrainGround } from '@/components/ui/GrainOverlay';
import { StatusFrost } from '@/components/ui/StatusFrost';
import { View } from 'react-native';
import Animated, { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useChromeScrollHandler } from '@/lib/motion/chrome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
  // The tab bar floats over the page; keep the last card clear of it.
  const underBar = useBottomTabBarHeight();
  // Reading down shrinks the floating tab pill; scrolling up brings it back.
  const scrollY = useSharedValue(0);
  const onScroll = useChromeScrollHandler(scrollY, useReducedMotion());
  // The page runs to the top edge of the screen: the first card starts
  // under the clock and the rest scroll beneath it (the counter used to stop
  // at the status bar and cut every card off on that line — Rick, 2026-09-09).
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <GrainGround />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 + underBar }}
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
      </Animated.ScrollView>
      <StatusFrost scrollY={scrollY} insetTop={insets.top} />
    </View>
  );
}
