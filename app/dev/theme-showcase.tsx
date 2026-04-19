import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, TYPE, RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { CupArt } from '@/components/brand/CupArt';
import { Icon, type IconName } from '@/components/brand/Icon';
import { StarDots } from '@/components/brand/StarDots';

const COLORS: { name: keyof typeof T; value: string }[] = (
  Object.entries(T) as [keyof typeof T, string][]
).map(([name, value]) => ({ name, value }));

const ICONS: IconName[] = [
  'bag', 'bell', 'pin', 'star', 'arrow', 'arrowL', 'plus', 'check',
  'search', 'close', 'home', 'cafe', 'receipt', 'user', 'qr', 'clock',
  'chevR', 'logout', 'gift', 'cup', 'settings',
];

const TYPE_ENTRIES = Object.entries(TYPE) as [keyof typeof TYPE, (typeof TYPE)[keyof typeof TYPE]][];

export default function ThemeShowcase() {
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.devOnly}>This screen is only available in dev builds.</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[TYPE.screenTitleLg, styles.h]}>Theme showcase</Text>

        <Section title="Colors (T.*)">
          <View style={styles.swatchGrid}>
            {COLORS.map(({ name, value }) => (
              <View key={name} style={styles.swatchCell}>
                <View style={[styles.swatch, { backgroundColor: value }]} />
                <Text style={[TYPE.label, { color: T.ink }]}>{name}</Text>
                <Text style={[TYPE.priceSm, { color: T.ink3 }]}>{value}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Typography (TYPE.*)">
          {TYPE_ENTRIES.map(([name, preset]) => (
            <View key={name} style={styles.typeRow}>
              <Text style={[TYPE.label, { color: T.ink3 }]}>{name}</Text>
              <Text style={[preset, { color: T.ink }]}>
                The quick brown fox — $4.50
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Icons">
          <View style={styles.iconGrid}>
            {ICONS.map((name) => (
              <View key={name} style={styles.iconCell}>
                <Icon name={name} color={T.ink} size={24} />
                <Text style={[TYPE.label, { color: T.ink3, marginTop: 4 }]}>{name}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.iconGrid, { marginTop: SPACING.lg }]}>
            {ICONS.map((name) => (
              <View key={`brand-${name}`} style={styles.iconCell}>
                <Icon name={name} color={T.brand} size={24} />
              </View>
            ))}
          </View>
        </Section>

        <Section title="CupArt">
          <View style={styles.cupRow}>
            <CupArt size={40} />
            <CupArt size={80} fill={T.peach} />
            <CupArt size={120} fill={T.sage} />
            <CupArt size={80} filled={false} />
          </View>
        </Section>

        <Section title="StarDots">
          <View style={{ gap: SPACING.md }}>
            <StarDots value={0} />
            <StarDots value={3} />
            <StarDots value={8} />
            <StarDots value={9} />
          </View>
        </Section>

        <Section title="Shadows">
          <View style={styles.shadowRow}>
            <View style={[styles.shadowCard, SHADOW.card]}>
              <Text style={TYPE.label}>card</Text>
            </View>
            <View style={[styles.shadowCard, SHADOW.miniCart, { backgroundColor: T.brand }]}>
              <Text style={[TYPE.label, { color: T.cream }]}>miniCart</Text>
            </View>
            <View style={[styles.shadowCard, SHADOW.primaryCta, { backgroundColor: T.ink }]}>
              <Text style={[TYPE.label, { color: T.cream }]}>primaryCta</Text>
            </View>
            <View style={[styles.shadowCard, SHADOW.successBubble, { backgroundColor: T.sage }]}>
              <Text style={[TYPE.label, { color: T.ink }]}>success</Text>
            </View>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[TYPE.cardTitle, { color: T.ink, marginBottom: SPACING.md }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl * 2 },
  h: { color: T.ink, marginBottom: SPACING.lg },
  devOnly: { padding: SPACING.xl, color: T.ink2 },
  section: { marginBottom: SPACING.xl },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  swatchCell: { width: '30%' },
  swatch: {
    height: 56,
    borderRadius: RADIUS.tile,
    marginBottom: SPACING.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
  },
  typeRow: { marginBottom: SPACING.md, gap: 2 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  iconCell: {
    width: 56,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  cupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.lg },
  shadowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  shadowCard: {
    width: 110,
    height: 70,
    borderRadius: RADIUS.card,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
