import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Icon } from '@/components/icons';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, radius } from '../lib/theme';
import { useAuth } from '../lib/auth';

const HEALTH_LINKS = [
  { icon: 'flask', label: 'Lab Results', route: '/(tabs)/labs', color: '#8B5CF6' },
  { icon: 'medkit', label: 'Prescriptions', route: '/(tabs)/prescriptions', color: '#EC4899' },
  { icon: 'chatbubbles', label: 'Messages', route: '/(tabs)/messages', color: '#06B6D4' },
  { icon: 'shield-checkmark', label: 'Immunizations', route: '/(tabs)/immunizations', color: '#F59E0B' },
];

const SETTINGS_LINKS = [
  { icon: 'notifications-outline', label: 'Notifications', color: colors.textSecondary },
  { icon: 'language-outline', label: 'Language', color: colors.textSecondary },
  { icon: 'moon-outline', label: 'Appearance', color: colors.textSecondary },
  { icon: 'help-circle-outline', label: 'Help & Support', color: colors.textSecondary },
  { icon: 'information-circle-outline', label: 'About TamamHealth', color: colors.textSecondary },
];

export default function ProfileScreen() {
  const { patient, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Patient card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {patient?.firstName.charAt(0)}{patient?.surname.charAt(0)}
          </Text>
        </View>
        <Text style={styles.profileName}>{patient?.firstName} {patient?.surname}</Text>
        <Text style={styles.profileHn}>{patient?.hospitalNumber}</Text>

        <View style={styles.profileMeta}>
          <View style={styles.metaChip}>
            <Icon name="calendar-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{patient?.dateOfBirth}</Text>
          </View>
          <View style={styles.metaChip}>
            <Icon name="male-female-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{patient?.gender}</Text>
          </View>
          <View style={styles.metaChip}>
            <Icon name="call-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>{patient?.phone}</Text>
          </View>
        </View>
      </View>

      {/* Health Services */}
      <Text style={styles.sectionTitle}>Health Services</Text>
      <View style={styles.linksCard}>
        {HEALTH_LINKS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.linkRow, i < HEALTH_LINKS.length - 1 && styles.linkBorder]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.6}
          >
            <View style={[styles.linkIcon, { backgroundColor: item.color + '12' }]}>
              <Icon name={item.icon as any} size={18} color={item.color} />
            </View>
            <Text style={styles.linkLabel}>{item.label}</Text>
            <Icon name="chevron-forward" size={16} color={colors.cream300} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.linksCard}>
        {SETTINGS_LINKS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.linkRow, i < SETTINGS_LINKS.length - 1 && styles.linkBorder]}
            activeOpacity={0.6}
          >
            <Icon name={item.icon as any} size={20} color={item.color} style={{ width: 28 }} />
            <Text style={styles.linkLabel}>{item.label}</Text>
            <Icon name="chevron-forward" size={16} color={colors.cream300} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="log-out-outline" size={18} color={colors.red} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.flagStripe}>
          {['#000', '#C44536', '#FFF', '#1B9E77', '#2A7A6E', '#E4A84B'].map((c, i) => (
            <View key={i} style={[styles.stripe, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.footerText}>TamamHealth Health Technologies</Text>
        <Text style={styles.footerVersion}>v0.1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.md, paddingBottom: 100 },

  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.cream200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarText: { color: colors.gold, fontSize: 24, fontWeight: '800' },
  profileName: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  profileHn: { fontSize: fontSize.sm, color: colors.textTertiary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  profileMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'center' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.cream, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
  },
  metaText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },

  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: spacing.sm, marginLeft: spacing.xs,
  },

  linksCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.cream200, marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  linkBorder: { borderBottomWidth: 1, borderBottomColor: colors.cream100 },
  linkIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 14,
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: spacing.xl,
  },
  logoutText: { fontSize: fontSize.md, fontWeight: '700', color: colors.red },

  footer: { alignItems: 'center', marginBottom: spacing.md },
  flagStripe: { flexDirection: 'row', width: 100, height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: spacing.sm },
  stripe: { flex: 1 },
  footerText: { fontSize: fontSize.xs, color: colors.textTertiary },
  footerVersion: { fontSize: 9, color: colors.cream300, marginTop: 2 },
});
