import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput, TouchableOpacity } from 'react-native';

// Disable system font scaling globally — Mandy App uses fixed font sizes
// regardless of the user's accessibility font-size setting.
// defaultProps was removed from RN 0.81 TS types but works at runtime.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.allowFontScaling = false;
import { Icon } from '@/components/brand/Icon';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';
import { ItemDetailSheet } from '@/components/menu/ItemDetailSheet';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { AuthGate } from '@/components/auth/AuthGate';
import { useReadyVibration } from '@/hooks/use-ready-vibration';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { T } from '@/constants/theme';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fraunces_500Medium } from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';

SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore — splash may already be auto-hidden in some dev contexts
});

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: T.brand,
    background: T.bg,
    card: T.card,
    text: T.ink,
    border: T.line,
  },
};

function PushMount() {
  usePushNotifications()
  return null
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: T.bg }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <ThemeProvider value={LightTheme}>
          <AuthGate>
          <Stack>
            <Stack.Screen name="login" options={{ headerShown: false, animation: 'none' }} />
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
                    <Icon name="arrowL" size={24} color={T.ink} />
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
                      <Icon name="arrowL" size={24} color={T.ink} />
                      <Text style={{ fontSize: 17, color: T.ink }}>{label}</Text>
                    </TouchableOpacity>
                  ),
                }
              }}
            />
            <Stack.Screen
              name="messages"
              options={({ route }) => {
                const from = (route.params as { from?: string } | undefined)?.from
                const label = from === 'home' ? 'Home' : 'Back'
                return {
                  title: 'Messages',
                  headerBackTitle: label,
                  headerShown: true,
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
                    <Icon name="home" size={24} color={T.ink} />
                  </TouchableOpacity>
                ),
              }}
            />
            <Stack.Screen
              name="order-complaint"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
          <ItemDetailSheet />
          <StatusBar style="dark" />
          <PushMount />
          </AuthGate>
        </ThemeProvider>
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
