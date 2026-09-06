import { useMemo, useState, type ReactNode } from 'react'
import { ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useAuth } from '@/components/auth/AuthProvider'
import { AppDownloadDiscountCard, appDownloadAvailable, useAppDownloadStatus } from '@/components/account/AppDownloadDiscountCard'
import { TastingPromoCard, tastingPromoAvailable, useTastingPromoStatus } from '@/components/account/TastingPromoCard'
import { FRAGRANCE_BLIND_BOX_PROMO } from '@/lib/constants'
import { T, TYPE } from '@/constants/theme'
import { DailySpecial } from './DailySpecial'
import { FragranceBlindBox } from './FragranceBlindBox'
import { SectionHead } from './SectionHead'

// Every offer the app can show — the new-member gift, a tasting window, the
// app-download gift, a blind-box campaign — used to stack on Home as three
// or four cards, pushing the rewards card off the first screen. Now one
// section, one card wide, swipe for the next: the live tasting window
// leads (it is the perishable one), the rest follow. The cards keep their
// own copy and their own availability rules; this only decides how many
// there are and lays them side by side.

export function OffersCarousel() {
  const { width } = useWindowDimensions()
  const { profile, welcomeDiscount } = useAuth()
  const tasting = useTastingPromoStatus()
  const appDownload = useAppDownloadStatus()
  const [page, setPage] = useState(0)

  const pages = useMemo(() => {
    const out: { key: string; node: ReactNode }[] = []
    if (tastingPromoAvailable(tasting)) out.push({ key: 'tasting', node: <TastingPromoCard status={tasting} /> })
    if (profile && welcomeDiscount?.available) out.push({ key: 'welcome', node: <DailySpecial /> })
    if (appDownloadAvailable(appDownload)) out.push({ key: 'download', node: <AppDownloadDiscountCard status={appDownload} /> })
    if (FRAGRANCE_BLIND_BOX_PROMO) out.push({ key: 'blindbox', node: <FragranceBlindBox /> })
    return out
  }, [tasting, profile, welcomeDiscount, appDownload])

  if (pages.length === 0) return null

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== page) setPage(Math.max(0, Math.min(pages.length - 1, i)))
  }

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead eyebrow="Offers" label="For you" count={pages.length > 1 ? `${pages.length} offers` : undefined} />
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        scrollEnabled={pages.length > 1}
      >
        {pages.map((p) => (
          <View key={p.key} style={{ width }}>
            {p.node}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: -6 }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {pages.map((p, i) => (
              <View
                key={p.key}
                style={{
                  width: i === page ? 16 : 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: i === page ? T.brand : T.ink4,
                }}
              />
            ))}
          </View>
          <Text style={[TYPE.eyebrow, { fontSize: 10, color: T.ink3 }]}>{`${page + 1} / ${pages.length}`}</Text>
        </View>
      ) : null}
    </View>
  )
}
