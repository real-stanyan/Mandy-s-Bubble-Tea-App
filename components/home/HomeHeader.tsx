import { Text, View } from 'react-native';
import { PressScale } from '@/components/ui/PressScale';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCartStore } from '@/store/cart';
import { useCartSheetStore } from '@/store/cartSheet';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE } from '@/constants/theme';
import { timeGreeting } from './helpers';
import { useStoreStatus } from '@/hooks/use-store-status';
import { useKitchenLoad } from '@/hooks/use-kitchen-load';
import type { KitchenLevel } from '@/lib/kitchen-load';
import { PulseDot } from '@/components/ui/PulseDot';
import { useRouter } from 'expo-router';
import { useMessageEvents } from '@/hooks/use-message-events';

export function HomeHeader() {
  const { profile } = useAuth();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const showCart = useCartSheetStore((s) => s.show);
  const router = useRouter();
  const { hasTodayEvent } = useMessageEvents();

  const greeting = timeGreeting();
  const firstName = profile?.first_name?.trim() || (profile ? 'Friend' : 'Welcome');
  const nameSuffix = profile ? '.' : '.';
  const salutation = profile ? `${greeting},` : 'Hi there,';

  return (
    <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <Text style={[TYPE.body, { color: T.ink3 }]}>{salutation}</Text>
          <Text
            style={{
              fontFamily: 'ShantellSans_700Bold',
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
          <PressScale
            haptic
            hitSlop={6}
            onPress={() => router.push({ pathname: '/messages', params: { from: 'home' } })}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: 'rgba(42,30,20,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bell" color={T.ink} size={20} />
            {hasTodayEvent ? (
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
            ) : null}
          </PressScale>

          <PressScale
            haptic
            hitSlop={6}
            onPress={showCart}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: 'rgba(42,30,20,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
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
          </PressScale>
        </View>
      </View>

      <LivePill />
    </View>
  );
}

const MOOD: Record<KitchenLevel, string> = {
  quiet: 'Kitchen quiet',
  medium: 'Kitchen steady',
  busy: 'Kitchen busy',
};

/**
 * The store right now, in one line: open or not, and — while open — how
 * busy the kitchen is and how soon a cup is ready (the same bracketed
 * promise the checkout makes). The address lives on the store card below.
 */
function LivePill() {
  const status = useStoreStatus();
  const load = useKitchenLoad();
  const wait = status.open && load ? `${MOOD[load.level]} · ready in ${load.label}` : null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        paddingVertical: 5,
        paddingLeft: 9,
        paddingRight: 11,
        borderRadius: 999,
        backgroundColor: 'rgba(162,173,145,0.25)',
      }}
    >
      <PulseDot color={status.open ? T.green : T.ink4} size={6} active={status.open} />
      <Text
        style={{
          fontFamily: 'ShantellSans_500Medium',
          fontSize: 11.5,
          color: status.open ? T.greenDark : T.ink3,
        }}
      >
        {status.open ? `Open ${status.nextLabel}` : `Opens ${status.nextLabel}`}
      </Text>
      {wait ? (
        <>
          <Text style={{ fontFamily: 'ShantellSans_400Regular', fontSize: 11.5, color: T.ink3 }}>·</Text>
          <Text style={{ fontFamily: 'ShantellSans_400Regular', fontSize: 11.5, color: T.ink2 }}>{wait}</Text>
        </>
      ) : null}
    </View>
  );
}
