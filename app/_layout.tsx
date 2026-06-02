import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState } from 'react';
import { AuthProvider } from '../context/AuthContext';
import AppSplash from '../components/AppSplash';

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <Stack screenOptions={{ headerShown: false }} />
        {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
      </AuthProvider>
    </SafeAreaProvider>
  );
}
