import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth/AuthProvider';
import { useOrdersStore } from '@/store/orders';
import { Icon, type IconName } from '@/components/brand/Icon';
import { CartSheet } from '@/components/cart/CartSheet';
import { SwipeTabs } from '@/components/navigation/SwipeTabs';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <Icon name={name} color={color} size={24} />;
}

export default function TabLayout() {
  const { profile } = useAuth();
  const refreshOrders = useOrdersStore((s) => s.refresh);
  const clearOrders = useOrdersStore((s) => s.clear);
  const unfinishedCount = useOrdersStore((s) => s.activeOrderCount);

  useEffect(() => {
    if (profile) refreshOrders();
    else clearOrders();
  }, [profile, refreshOrders, clearOrders]);

  return (
    <View style={styles.root}>
      <SwipeTabs
        // The four tabs are pages side by side: a horizontal drag pulls the
        // next one in (components/navigation/SwipeTabs). The floating pill
        // (components/ui/FloatingTabBar) draws itself over the page and its
        // window follows the pager; the bag capsule sits beside it in the
        // same dock (components/cart/CartCapsule); screens clear it with
        // useBottomTabBarHeight. The pager draws no header — every tab
        // hides its own.
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <SwipeTabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          }}
        />
        <SwipeTabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="cafe" color={color} />,
          }}
        />
        <SwipeTabs.Screen
          name="order"
          options={{
            title: 'My Orders',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="receipt" color={color} />,
            tabBarBadge: unfinishedCount > 0 ? unfinishedCount : undefined,
          }}
        />
        <SwipeTabs.Screen
          name="account"
          options={{
            title: 'Account',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
          }}
        />
      </SwipeTabs>
      <CartSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
