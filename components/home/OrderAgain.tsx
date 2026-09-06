import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useOrdersStore } from '@/store/orders'
import { useCartStore } from '@/store/cart'
import { useMenu } from '@/hooks/use-menu'
import { SquareImage } from '@/components/ui/SquareImage'
import { IMG_THUMB } from '@/lib/optimized-image'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import { SectionHead } from './SectionHead'
import { computeOrderAgain, type YourUsualItem } from './helpers'

// The counter's first question — "the usual?" — as a rail: the drinks this
// customer keeps ordering, exactly as they order them (size, sugar, ice,
// toppings), a photo each, and one tap to put one in the bag. The most
// ordered build leads and wears its count; the rest follow by recency.

const CARD_W = 152
const PHOTO = CARD_W - 16

export function OrderAgain() {
  const router = useRouter()
  const orders = useOrdersStore((s) => s.orders)
  const { items } = useMenu()
  const usuals = useMemo(() => computeOrderAgain(orders, 4), [orders])
  // A history line without a photo borrows the catalog's, by name.
  const photoByName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of items) {
      const name = item.itemData?.name
      if (name && item.imageUrl) map[name] = item.imageUrl
    }
    return map
  }, [items])

  if (usuals.length === 0) return null
  const lead = usuals[0]

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead
        eyebrow={lead.count > 1 ? `Ordered ${lead.count} times` : 'Last order'}
        label="Order again"
        actionLabel="History"
        onAction={() => router.push('/(tabs)/order')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_W + 10}
        contentContainerStyle={{ paddingLeft: 20, paddingRight: 14, gap: 10 }}
      >
        {usuals.map((u, i) => (
          <UsualCard key={u.key} usual={u} lead={i === 0} photo={u.imageUrl ?? photoByName[u.name]} />
        ))}
      </ScrollView>
    </View>
  )
}

function UsualCard({ usual, lead, photo }: { usual: YourUsualItem; lead: boolean; photo?: string }) {
  const addItem = useCartStore((s) => s.addItem)
  const [adding, setAdding] = useState(false)
  const onAdd = () => {
    addItem({
      id: usual.itemId,
      variationId: usual.variationId,
      name: usual.name,
      price: usual.priceCents,
      imageUrl: usual.imageUrl,
      variationName: usual.variationName,
      modifiers: usual.modifiers.map((m) => ({ id: m.id, name: m.name, listName: m.listName, priceCents: m.priceCents })),
    })
    setAdding(true)
    setTimeout(() => setAdding(false), 900)
  }
  const chip = lead ? (usual.count > 1 ? `YOUR USUAL · ${usual.count}×` : 'LAST ORDER') : null

  return (
    <View
      style={{
        width: CARD_W,
        padding: 8,
        paddingBottom: 10,
        backgroundColor: T.card,
        borderRadius: RADIUS.card,
        borderWidth: 1,
        borderColor: T.line,
        ...SHADOW.card,
      }}
    >
      <View
        style={{
          width: PHOTO,
          height: PHOTO,
          borderRadius: RADIUS.tile,
          overflow: 'hidden',
          backgroundColor: T.bg2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {photo ? (
          <SquareImage url={photo} width={IMG_THUMB} style={{ width: PHOTO, height: PHOTO }} />
        ) : (
          <CupArt fill={T.brand} stroke={T.ink} size={56} />
        )}
      </View>
      {chip ? (
        <View
          style={{
            position: 'absolute',
            left: 14,
            top: 14,
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: '#2A1E14',
          }}
        >
          <Text style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 9, letterSpacing: 1, color: '#FFF3DE' }}>{chip}</Text>
        </View>
      ) : null}
      <Text
        style={{ fontFamily: 'ShantellSans_700Bold', fontSize: 14, lineHeight: 17, letterSpacing: -0.2, color: T.ink, marginTop: 8, marginHorizontal: 2 }}
        numberOfLines={1}
      >
        {usual.name}
      </Text>
      <Text style={[TYPE.body, { fontSize: 11.5, lineHeight: 15, color: T.ink3, marginTop: 1, marginHorizontal: 2, paddingRight: 30 }]} numberOfLines={1}>
        {usual.subtitle || usual.variationName || 'As ordered'}
      </Text>
      <Text style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 12.5, color: T.ink2, marginTop: 6, marginHorizontal: 2 }}>
        {`A$${(usual.priceCents / 100).toFixed(2)}`}
      </Text>
      <Pressable
        onPress={onAdd}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Add ${usual.name} to bag`}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 10,
          bottom: 10,
          width: 32,
          height: 32,
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
        {adding ? <Icon name="check" color="#fff" size={14} /> : <Icon name="plus" color="#fff" size={16} />}
      </Pressable>
    </View>
  )
}
