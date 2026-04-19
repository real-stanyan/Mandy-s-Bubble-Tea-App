import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCartStore } from '@/store/cart';
import { useCartSheetStore } from '@/store/cartSheet';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE } from '@/constants/theme';
import { timeGreeting, getStoreStatus } from './helpers';

export function HomeHeader() {
  const { profile } = useAuth();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const showCart = useCartSheetStore((s) => s.show);

  const greeting = timeGreeting();
  const firstName = profile?.first_name?.trim() || (profile ? 'Friend' : 'Welcome');
  const nameSuffix = profile ? '.' : '.';
  const salutation = profile ? `${greeting},` : 'Hi there,';

  const status = getStoreStatus();

  return (
    <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <Text style={[TYPE.body, { color: T.ink3 }]}>{salutation}</Text>
          <Text
            style={{
              fontFamily: 'Fraunces_500Medium',
              fontSize: 30,
              lineHeight: 33,
              letterSpacing: -0.8,
              color: T.ink,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {firstName}{nameSuffix}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            hitSlop={6}
            onPress={() => { /* notifications out of scope */ }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: 'rgba(42,30,20,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="bell" color={T.ink} size={20} />
            <View
              style={{
                position: 'absolute',
                top: 9,
                right: 10,
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: T.peach,
                borderWidth: 1.5,
                borderColor: T.paper,
              }}
            />
          </Pressable>

          <Pressable
            hitSlop={6}
            onPress={showCart}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: 'rgba(42,30,20,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="bag" color={T.ink} size={20} />
            {cartCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  paddingHorizontal: 4,
                  backgroundColor: T.peach,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: T.ink }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View
        style={{
          alignSelf: 'flex-start',
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 4,
          paddingLeft: 8,
          paddingRight: 10,
          borderRadius: 999,
          backgroundColor: 'rgba(162,173,145,0.25)',
        }}
      >
        <Icon name="pin" color={T.brand} size={10} />
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: T.ink2 }}>
          Southport · 34 Davenport St
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, color: T.ink3 }}>·</Text>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 11.5,
            color: status.open ? T.greenDark : T.ink3,
          }}
        >
          {status.open ? `Open ${status.nextLabel}` : `Opens ${status.nextLabel}`}
        </Text>
      </View>
    </View>
  );
}
