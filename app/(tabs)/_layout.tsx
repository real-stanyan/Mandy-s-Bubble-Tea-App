import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';

import { useAuth } from '@/components/auth/AuthProvider';
import { useOrdersStore } from '@/store/orders';
import { Icon, type IconName } from '@/components/brand/Icon';
import { MiniCartBar } from '@/components/cart/MiniCartBar';
import { CartSheet } from '@/components/cart/CartSheet';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { T } from '@/constants/theme';

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
      <Tabs
        // The floating pill (components/ui/FloatingTabBar) draws itself over
        // the page; screens clear it with useBottomTabBarHeight.
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: T.paper },
          headerTintColor: T.ink,
          headerShown: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="cafe" color={color} />,
          }}
        />
        <Tabs.Screen
          name="order"
          options={{
            title: 'My Orders',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="receipt" color={color} />,
            tabBarBadge: unfinishedCount > 0 ? unfinishedCount : undefined,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
          }}
        />
      </Tabs>
      <MiniCartBar />
      <CartSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
