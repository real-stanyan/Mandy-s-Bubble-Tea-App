import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BRAND } from '@/lib/constants';
import { useAuth } from '@/components/auth/AuthProvider';
import { useOrdersStore } from '@/store/orders';

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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND.color,
        tabBarInactiveTintColor: '#687076',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e0e0e0' },
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#11181C',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cafe-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="order"
        options={{
          title: 'My Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
          tabBarBadge: unfinishedCount > 0 ? unfinishedCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: BRAND.color,
            color: '#fff',
            fontSize: 11,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{ href: null }}
      />
    </Tabs>
  );
}
