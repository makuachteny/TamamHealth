import { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { StoreProvider, useStore } from '../src/lib/store';
import { NetworkProvider } from '../src/lib/network';
import { SyncProvider } from '../src/lib/sync-context';
import LandingScreen from '../src/screens/LandingScreen';
import LoginScreen from '../src/screens/LoginScreen';
import { colors } from '../src/lib/theme';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { dbReady } = useStore();
  const [showLogin, setShowLogin] = useState(false);

  // Wait for SQLite + initial token hydration before deciding what to show.
  if (!dbReady || isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  // Unauthenticated: Landing → tap "Get Started" → real Login screen.
  if (!isAuthenticated) {
    if (!showLogin) {
      return <LandingScreen onGetStarted={() => setShowLogin(true)} />;
    }
    return <LoginScreen />;
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
