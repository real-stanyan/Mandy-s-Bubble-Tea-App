import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useOrdersStore } from '@/store/orders';
import { useCartStore } from '@/store/cart';
import { Icon } from '@/components/brand/Icon';
import { CupArt } from '@/components/brand/CupArt';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';
import { SectionHead } from './SectionHead';
import { computeYourUsual } from './helpers';

export function YourUsual() {
  const orders = useOrdersStore((s) => s.orders);
  const addItem = useCartStore((s) => s.addItem);
  const usual = useMemo(() => computeYourUsual(orders), [orders]);
  const [adding, setAdding] = useState(false);

  if (!usual) return null;

  const onAdd = () => {
    addItem({
      id: usual.itemId,
      variationId: usual.variationId,
      name: usual.name,
      price: usual.priceCents,
      imageUrl: usual.imageUrl,
      variationName: usual.variationName,
      modifiers: usual.modifiers.map((m) => ({
        id: m.id,
        name: m.name,
        listName: m.listName,
        priceCents: m.priceCents,
      })),
    });
    setAdding(true);
    setTimeout(() => setAdding(false), 900);
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead label="Your usual" count={`ordered ${usual.count}×`} />
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            backgroundColor: T.card,
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: T.line,
            ...SHADOW.card,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: T.sage,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {usual.imageUrl ? (
              <Image
                source={{ uri: usual.imageUrl }}
                style={{ width: 72, height: 72 }}
                contentFit="cover"
              />
            ) : (
              <CupArt fill={T.brand} stroke={T.ink} size={48} />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: 'Fraunces_500Medium',
                fontSize: 18,
                lineHeight: 21,
                letterSpacing: -0.3,
                color: T.ink,
              }}
              numberOfLines={1}
            >
              {usual.name}
            </Text>
            {usual.subtitle ? (
              <Text
                style={[TYPE.body, { color: T.ink3, marginTop: 2 }]}
                numberOfLines={1}
              >
                {usual.subtitle}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                fontSize: 13,
                color: T.ink2,
                marginTop: 4,
              }}
            >
              {`A$${(usual.priceCents / 100).toFixed(2)}`}
            </Text>
          </View>

          <Pressable
            onPress={onAdd}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: T.brand,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: adding ? 0.92 : pressed ? 0.95 : 1 }],
              shadowColor: 'rgba(141,85,36,0.5)',
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 14,
              elevation: 3,
            })}
          >
            {adding ? (
              <Icon name="check" color="#fff" size={16} />
            ) : (
              <Icon name="plus" color="#fff" size={18} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
