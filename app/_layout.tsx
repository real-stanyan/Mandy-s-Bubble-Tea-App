import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#C43A10',
    background: '#fff',
    card: '#fff',
    text: '#11181C',
    border: '#e0e0e0',
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={LightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="menu/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="checkout" options={{ headerShown: true, title: 'Checkout' }} />
        <Stack.Screen
          name="order-confirmation"
          options={{ headerShown: true, title: 'Order Confirmed', headerBackVisible: false }}
        />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
