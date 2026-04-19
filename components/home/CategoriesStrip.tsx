import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMenu } from '@/hooks/use-menu';
import { T, TYPE, RADIUS } from '@/constants/theme';
import { SectionHead } from './SectionHead';
import { normalizeSlug } from './helpers';

type HomeCategory = {
  slug: string;
  label: string;
  color: string;
  swatch: string;
};

const HOME_CATEGORIES: readonly HomeCategory[] = [
  { slug: 'milky',            label: 'Milky',            color: '#F5E1C5', swatch: '#D9A066' },
  { slug: 'fruity',           label: 'Fruity',           color: '#FCE1C9', swatch: '#F27D45' },
  { slug: 'fruity-black-tea', label: 'Fruity Black Tea', color: '#EFDACB', swatch: '#8C5635' },
  { slug: 'fresh-brew',       label: 'Fresh Brew',       color: '#E8DAC6', swatch: '#6B3E15' },
  { slug: 'frozen',           label: 'Frozen',           color: '#D8E4E8', swatch: '#6EA3B0' },
  { slug: 'cheese-cream',     label: 'Cheese Cream',     color: '#FFF1D6', swatch: '#E8B44E' },
  { slug: 'special-mix',      label: 'Special Mix',      color: '#E6DDEB', swatch: '#8B6AA8' },
] as const;

export function CategoriesStrip() {
  const router = useRouter();
  const { items, categories } = useMenu();

  const countsBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) {
      const slug = normalizeSlug(cat.name);
      const n = items.filter((item) =>
        (item.itemData?.categories ?? []).some((c) => c.id === cat.id),
      ).length;
      map.set(slug, (map.get(slug) ?? 0) + n);
    }
    return map;
  }, [items, categories]);

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead
        label="Browse the menu"
        actionLabel="See all"
        onAction={() => router.push('/(tabs)/menu')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={140}
        contentContainerStyle={{ paddingLeft: 20, paddingRight: 14, gap: 10 }}
      >
        {HOME_CATEGORIES.map((c) => {
          const count = countsBySlug.get(c.slug);
          return (
            <Pressable
              key={c.slug}
              onPress={() => router.push('/(tabs)/menu')}
              style={({ pressed }) => ({
                width: 130,
                height: 84,
                borderRadius: RADIUS.tile + 4,
                backgroundColor: c.color,
                padding: 12,
                overflow: 'hidden',
                position: 'relative',
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View
                style={{
                  position: 'absolute',
                  right: -10,
                  bottom: -10,
                  width: 50,
                  height: 50,
                  borderRadius: 999,
                  backgroundColor: c.swatch,
                  opacity: 0.85,
                }}
              />
              <Text
                style={{
                  fontFamily: 'Fraunces_500Medium',
                  fontSize: 15,
                  lineHeight: 17,
                  letterSpacing: -0.2,
                  color: T.ink,
                }}
              >
                {c.label}
              </Text>
              <Text
                style={[
                  TYPE.eyebrow,
                  {
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    color: T.ink3,
                    fontSize: 10.5,
                    letterSpacing: 1,
                  },
                ]}
              >
                {count == null ? '—' : `${count} drinks`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
