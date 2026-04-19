import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';
import { ItemDetailSheet } from '@/components/menu/ItemDetailSheet';
import { CartSheet } from '@/components/cart/CartSheet';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { useReadyVibration } from '@/hooks/use-ready-vibration';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore — splash may already be auto-hidden in some dev contexts
});

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#8D5524',
    background: '#fff',
    card: '#fff',
    text: '#11181C',
    border: '#e0e0e0',
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);
  useReadyVibration();
  if (!fontsLoaded) {
    return null;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <ThemeProvider value={LightTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Menu' }} />
            <Stack.Screen name="menu/[id]" options={{ headerShown: true, title: '' }} />
            <Stack.Screen
              name="checkout"
              options={{
                headerShown: true,
                title: 'Checkout',
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/menu'))}
                    hitSlop={12}
                    style={{ paddingHorizontal: 4 }}
                  >
                    <Ionicons name="chevron-back" size={26} color="#11181C" />
                  </TouchableOpacity>
                ),
              }}
            />
            <Stack.Screen
              name="order-detail"
              options={({ route }) => {
                const from = (route.params as { from?: string } | undefined)?.from
                const label = from === 'orders' ? 'My Orders' : 'Account'
                const fallback = from === 'orders' ? '/(tabs)/order' : '/(tabs)/account'
                return {
                  headerShown: true,
                  title: 'Order Detail',
                  headerBackVisible: false,
                  headerLeft: () => (
                    <TouchableOpacity
                      onPress={() =>
                        router.canGoBack() ? router.back() : router.replace(fallback)
                      }
                      hitSlop={12}
                      style={{
                        paddingHorizontal: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Ionicons name="chevron-back" size={26} color="#11181C" />
                      <Text style={{ fontSize: 17, color: '#11181C' }}>{label}</Text>
                    </TouchableOpacity>
                  ),
                }
              }}
            />
            <Stack.Screen
              name="promotions"
              options={{ headerShown: true, title: 'Promotions', headerBackTitle: 'Account' }}
            />
            <Stack.Screen
              name="order-confirmation"
              options={{
                headerShown: true,
                title: 'Order Confirmed',
                headerBackVisible: false,
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => router.replace('/(tabs)')}
                    hitSlop={12}
                    style={{ paddingHorizontal: 4 }}
                  >
                    <Ionicons name="home-outline" size={24} color="#11181C" />
                  </TouchableOpacity>
                ),
              }}
            />
          </Stack>
          <ItemDetailSheet />
          <CartSheet />
          <StatusBar style="dark" />
        </ThemeProvider>
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
