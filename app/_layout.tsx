import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import 'react-native-reanimated';
import { ItemDetailSheet } from '@/components/menu/ItemDetailSheet';

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider value={LightTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Menu' }} />
            <Stack.Screen name="menu/[id]" options={{ headerShown: true, title: '' }} />
            <Stack.Screen
              name="checkout"
              options={{ headerShown: true, title: 'Checkout', headerBackTitle: 'Cart' }}
            />
            <Stack.Screen
              name="order-detail"
              options={{ headerShown: true, title: 'Order Detail', headerBackTitle: 'Account' }}
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
          <StatusBar style="dark" />
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
