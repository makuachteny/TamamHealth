import { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { StoreProvider, useStore } from '../src/lib/store';
import { NetworkProvider } from '../src/lib/network';
import { SyncProvider } from '../src/lib/sync-context';
import LandingScreen from '../src/screens/LandingScreen';
import { colors } from '../src/lib/theme';

function RootNavigator() {
  const { isAuthenticated, setBypass } = useAuth();
  const { dbReady } = useStore();
  const [showApp, setShowApp] = useState(false);

  // Wait for SQLite to be ready before showing anything
  if (!dbReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  // Landing → tap "Get Started" → go straight to app (bypass auth for now)
  if (!isAuthenticated && !showApp) {
    return (
      <LandingScreen
        onGetStarted={() => {
          setBypass(true);
          setShowApp(true);
        }}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StoreProvider>
        <NetworkProvider>
          <SyncProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SyncProvider>
        </NetworkProvider>
      </StoreProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
