// app/(tabs)/index.tsx
import { ScrollView, View } from 'react-native';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeLoyaltyHero } from '@/components/home/HomeLoyaltyHero';
import { YourUsual } from '@/components/home/YourUsual';
import { DailySpecial } from '@/components/home/DailySpecial';
import { CategoriesStrip } from '@/components/home/CategoriesStrip';
import { HotPicks } from '@/components/home/HeroCarousel';
import { StoreCard } from '@/components/home/StoreCard';
import { MiniCartBar } from '@/components/cart/MiniCartBar';
import { T } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        style={{ backgroundColor: T.bg }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />
        <HomeLoyaltyHero />
        <YourUsual />
        <DailySpecial />
        <CategoriesStrip />
        <HotPicks />
        <StoreCard />
      </ScrollView>
      <MiniCartBar />
    </View>
  );
}
