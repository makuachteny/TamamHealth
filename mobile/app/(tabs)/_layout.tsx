import { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform, type ColorValue } from 'react-native';
import { Icon } from '@/components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/lib/auth';
import DrawerMenu from '../../src/components/DrawerMenu';
import SyncStatusBar from '../../src/components/SyncStatusBar';

const C = {
  active: '#1B9E77',
  inactive: '#A8B5B2',
  headerBg: '#1A3A3A',
  gold: '#E4A84B',
};

function CustomHeader() {
  const insets = useSafeAreaInsets();
  const { patient } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();

  const initials = patient
    ? `${patient.firstName.charAt(0)}${patient.surname.charAt(0)}`
    : 'T';

  const handleNavigate = (screen: string) => {
    if (screen === 'home') router.replace('/(tabs)');
    else router.push(`/(tabs)/${screen}` as any);
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {/* Burger */}
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.burgerBtn} activeOpacity={0.7}>
          <View style={styles.burgerLines}>
            <View style={styles.burgerLine} />
            <View style={[styles.burgerLine, styles.burgerLineShort]} />
            <View style={styles.burgerLine} />
          </View>
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.headerTitle}>TamamHealth</Text>

        {/* Avatar */}
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} style={styles.avatarBtn} activeOpacity={0.7}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <DrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleNavigate}
      />
    </>
  );
}

function HeaderWithSync() {
  return (
    <View>
      <CustomHeader />
      <SyncStatusBar />
    </View>
  );
}

function TabIcon({ name, color, focused }: { name: string; color: ColorValue; focused: boolean }) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
      <Icon name={name as any} size={21} color={String(color)} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        header: () => <HeaderWithSync />,
        tabBarActiveTintColor: C.active,
        tabBarInactiveTintColor: C.inactive,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom || 4,
          paddingTop: 4,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
            },
            android: { elevation: 12 },
          }),
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'document-text' : 'document-text-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Visits',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Billing',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'wallet' : 'wallet-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="labs" options={{ href: null }} />
      <Tabs.Screen name="prescriptions" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="immunizations" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  burgerBtn: { padding: 8 },
  burgerLines: { width: 20, gap: 4 },
  burgerLine: { height: 2, backgroundColor: '#FFFFFF', borderRadius: 1 },
  burgerLineShort: { width: 14 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  avatarBtn: { padding: 4 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.headerBg, fontSize: 12, fontWeight: '800' },
  tabIconWrap: {
    width: 40, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
  },
  tabIconActive: { backgroundColor: 'rgba(27, 158, 119, 0.1)' },
});
