// components/home/StoreCard.tsx
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';
import { getStoreStatus } from './helpers';

const MAP_QUERY = '34 Davenport St Southport QLD 4215';

function openDirections() {
  const encoded = encodeURIComponent(MAP_QUERY);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${encoded}`,
    android: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  });
  if (url) Linking.openURL(url).catch(() => { /* swallow */ });
}

export function StoreCard() {
  const status = getStoreStatus();

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          backgroundColor: T.paper,
          borderRadius: RADIUS.card,
          borderWidth: 1,
          borderColor: T.line,
          ...SHADOW.card,
        }}
      >
        {/* Sage map thumbnail with grid + pin */}
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: T.sage,
            position: 'relative',
          }}
        >
          {/* 4 horizontal grid lines at 18px intervals */}
          {[18, 36, 54, 72].map((y) => (
            <View
              key={`h${y}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: y,
                height: 1,
                backgroundColor: T.paper,
                opacity: 0.5,
              }}
            />
          ))}
          {/* 4 vertical grid lines at 18px intervals */}
          {[18, 36, 54, 72].map((x) => (
            <View
              key={`v${x}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: x,
                width: 1,
                backgroundColor: T.paper,
                opacity: 0.5,
              }}
            />
          ))}
          {/* Pin: circle + rotated/translated to pseudo-teardrop */}
          <View
            style={{
              position: 'absolute',
              left: 38 - 7,
              top: 38 - 7,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: T.brand,
              borderWidth: 2,
              borderColor: '#fff',
              transform: [{ translateY: -2 }, { rotate: '-45deg' }],
            }}
          />
        </View>

        {/* Middle */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: status.open ? T.green : T.ink4,
              }}
            />
            <Text
              style={[
                TYPE.eyebrow,
                { fontSize: 11, color: status.open ? T.greenDark : T.ink3 },
              ]}
            >
              {status.open ? 'OPEN NOW' : 'CLOSED'}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'Fraunces_500Medium',
              fontSize: 16,
              letterSpacing: -0.3,
              color: T.ink,
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            Southport Store
          </Text>
          <Text
            style={[TYPE.body, { color: T.ink3, marginTop: 2, fontSize: 12, lineHeight: 17 }]}
            numberOfLines={2}
          >
            34 Davenport St · Gold Coast · Southport
          </Text>
        </View>

        {/* Directions */}
        <Pressable
          onPress={openDirections}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: T.ink4,
            backgroundColor: 'transparent',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12.5, color: T.ink }}>
            Directions
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
