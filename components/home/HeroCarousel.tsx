import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useItemSheetStore } from '@/store/itemSheet';
import { useMenu } from '@/hooks/use-menu';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';
import { SectionHead } from './SectionHead';

const SLIDES = [
  { image: require('@/assets/images/carousel/top_1.webp'), name: 'Brown Sugar Milk Tea', tagline: 'Creamy classic' },
  { image: require('@/assets/images/carousel/top_2.webp'), name: 'Mango Slushy',          tagline: 'Summer favourite' },
  { image: require('@/assets/images/carousel/top_3.webp'), name: 'Oreo Brulee Milk Tea',  tagline: 'Torched on top' },
  { image: require('@/assets/images/carousel/top_4.webp'), name: 'Lychee Black Tea',      tagline: 'Fresh & floral' },
  { image: require('@/assets/images/carousel/top_5.webp'), name: 'Red Dragon Fruit Slushy', tagline: 'Vibrant & cool' },
  { image: require('@/assets/images/carousel/top_6.webp'), name: 'Taro Milk Tea',         tagline: 'Silky smooth' },
];

const AUTOPLAY_MS = 5000;
const CARD_GAP = 12;
const CARD_RATIO = 1.15;

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function HeroCarousel() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.78);
  const cardHeight = Math.round(cardWidth * CARD_RATIO);
  const sidePadding = Math.round((width - cardWidth) / 2);
  const snapInterval = cardWidth + CARD_GAP;

  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const { items } = useMenu();

  const nameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const n = item.itemData?.name;
      if (n) map.set(normalize(n), item.id);
    }
    return map;
  }, [items]);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, []);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));
  };

  const handlePress = (name: string) => {
    const id = nameToId.get(normalize(name));
    if (id) useItemSheetStore.getState().open(id);
  };

  return (
    <View style={styles.wrap}>
      <SectionHead label="This week's favourites" eyebrow="HOT PICKS" />

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({
          length: snapInterval,
          offset: snapInterval * i,
          index: i,
        })}
        renderItem={({ item, index: i }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(item.name)}
            style={[styles.card, { width: cardWidth, height: cardHeight }]}
          >
            <Image
              source={item.image}
              style={[styles.cardImage, { width: cardWidth, height: cardHeight }]}
              contentFit="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.35)']}
              locations={[0.4, 1]}
              style={styles.cardGradient}
            />
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{`#${i + 1}`}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTag}>{item.tagline}</Text>
              <Text style={[TYPE.cardTitle, styles.cardName]} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// Alias: Phase 2 composes Home in terms of `<HotPicks />`; file rename is
// deferred to the Phase 7 cleanup.
export { HeroCarousel as HotPicks };

const styles = StyleSheet.create({
  wrap: { marginTop: 4, paddingBottom: 20 },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: T.sage,
    ...SHADOW.miniCart,
    shadowColor: T.brandDark,
  },
  cardImage: { position: 'absolute', top: 0, left: 0 },
  cardGradient: { ...StyleSheet.absoluteFillObject },
  rankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: T.paper,
  },
  rankBadgeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10.5,
    color: T.brand,
    letterSpacing: 0.5,
  },
  cardBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    gap: 6,
  },
  cardTag: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  cardName: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.ink4,
  },
  dotActive: {
    width: 22,
    backgroundColor: T.brand,
  },
});
