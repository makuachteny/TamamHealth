'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
  UserPlus,
  Users,
  X,
} from '@/components/icons/lucide';
import { useApp } from '@/lib/context';
import { getRoleConfig } from '@/lib/permissions';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { NavItem } from '@/lib/permissions';
import { usePatients } from '@/lib/hooks/usePatients';
import { patientFullName, patientGenderAge } from '@/lib/patient-utils';
import { formatPhoneDisplay } from '@/lib/field-formats';
import { useTranslation } from '@/lib/i18n/useTranslation';
import EhrModuleMenu from './EhrModuleMenu';
import EhrTopActions from './EhrTopActions';
import QuickActions from '@/components/QuickActions';
import {
  getPrimaryShortcutItems,
  groupNavItemsBySection,
  isHrefAllowed,
  uniqueAllowedNavItems,
} from './ehr-navigation';

export default function EhrTopRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { currentUser, logout, theme, toggleTheme } = useApp();
  const { canRegisterPatients } = usePermissions();
  const { patients } = usePatients();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const moduleRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !moduleOpen && !userOpen) return;
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
      if (moduleRef.current && !moduleRef.current.contains(event.target as Node)) {
        setModuleOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, moduleOpen, userOpen]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    searchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;
  const allowedRoutes = useMemo(() => roleConfig?.allowedRoutes || [], [roleConfig]);
  const homeHref = roleConfig?.defaultDashboard || '/dashboard';
  const roleLabel = roleConfig?.label || currentUser?.role.replace(/_/g, ' ') || 'Workspace';
  const canSearchPatients = isHrefAllowed('/patients', allowedRoutes);

  const navItems = useMemo(() => {
    if (!currentUser) return [];
    return uniqueAllowedNavItems(roleConfig?.navItems || [], allowedRoutes);
  }, [allowedRoutes, currentUser, roleConfig]);

  const navGroups = useMemo(() => groupNavItemsBySection(navItems), [navItems]);
  const quickActionItems = useMemo(() => getPrimaryShortcutItems(navItems), [navItems]);

  const navLabel = (item: NavItem): string => {
    const keyMap: Record<string, string> = {
      '/dashboard': 'nav.dashboard',
      '/patients': 'nav.patients',
      '/consultation': 'nav.consultation',
      '/appointments': 'nav.appointments',
      '/referrals': 'nav.referrals',
      '/lab': 'nav.lab',
      '/pharmacy': 'nav.pharmacy',
      '/immunizations': 'nav.immunizations',
      '/anc': 'nav.anc',
      '/births': 'nav.births',
      '/deaths': 'nav.deaths',
      '/surveillance': 'nav.surveillance',
      '/hospitals': 'nav.hospitals',
      '/reports': 'nav.reports',
      '/messages': 'nav.messages',
      '/settings': 'nav.settings',
      '/telehealth': 'nav.telehealth',
      '/government': 'nav.government',
      '/facility-settings': 'nav.facilitySettings',
      '/patient-intake': 'nav.patientIntake',
      '/payments': 'nav.payments',
      '/payments/claims': 'nav.claims',
      '/wards': 'nav.wards',
      '/blood-bank': 'nav.bloodBank',
    };
    const key = item.href ? keyMap[item.href] : undefined;
    if (key) {
      const translated = t(key);
      if (translated !== key) return translated;
    }
    return item.label;
  };

  const activeModuleItem = useMemo(() => {
    const isActiveHref = (href?: string) => !!href && (pathname === href || pathname?.startsWith(href + '/'));
    const matches = navItems
      .filter(item => isActiveHref(item.href))
      .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0));
    if (matches[0]) return matches[0];
    return quickActionItems.find(item => isActiveHref(item.href)) || null;
  }, [navItems, pathname, quickActionItems]);

  const ActiveModuleIcon = activeModuleItem?.icon || LayoutDashboard;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return patients
      .filter(patient => {
        const haystack = `${patientFullName(patient)} ${patient.hospitalNumber || ''} ${patient.phone || ''}`.toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 6);
  }, [patients, query]);

  const clearSearch = () => {
    setQuery('');
    setOpen(false);
  };

  const closeMobileSearch = () => {
    clearSearch();
    setMobileSearchOpen(false);
  };

  const openPatient = (id: string) => {
    clearSearch();
    router.push(`/patients/${id}`);
  };

  const openModule = (href?: string) => {
    if (!href) return;
    setModuleOpen(false);
    router.push(href);
  };

  const openProfilePage = () => {
    setUserOpen(false);
    router.push('/profile');
  };

  const openSettingsPage = () => {
    setUserOpen(false);
    router.push('/settings');
  };

  const initials = currentUser?.name
    ?.split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TH';

  const isRouteActive = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));
  const primaryCreateHref = ['/patient-intake', '/consultation', '/patients/new'].find(href => isHrefAllowed(href, allowedRoutes));
  const mobileTabs = [
    { href: homeHref, label: 'Dashboard', icon: LayoutDashboard },
    ...(canSearchPatients ? [{ href: '/patients', label: 'Patients', icon: Users }] : []),
    ...(isHrefAllowed('/appointments', allowedRoutes) ? [{ href: '/appointments', label: 'Calendar', icon: Calendar }] : []),
    ...(isHrefAllowed('/messages', allowedRoutes) ? [{ href: '/messages', label: 'Inbox', icon: MessageSquare }] : []),
  ];

  return (
    <>
    <header className={`ehr-top-rail ${mobileSearchOpen ? 'is-searching' : ''}`}>
      <div className="ehr-top-brand" onClick={() => router.push(homeHref)} role="button" tabIndex={0}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ehr-top-brand-logo-full" src="/assets/tamamhealth-logo-full-white.svg" alt="Tamam Healthcare System" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ehr-top-brand-logo-icon" src="/assets/tamamhealth-logo-icon-white.svg" alt="" aria-hidden="true" />
      </div>

      <nav className="ehr-top-modules" aria-label="Primary EHR modules" ref={moduleRef}>
        <button
          type="button"
          className={`ehr-module-trigger ${moduleOpen ? 'active' : ''}`}
          onClick={() => setModuleOpen(value => !value)}
          aria-expanded={moduleOpen}
          aria-haspopup="menu"
          title="Open module menu"
        >
          <ActiveModuleIcon className="w-5 h-5" />
          <ChevronDown className="w-3 h-3 ehr-module-chevron" />
        </button>

        {moduleOpen && (
          <EhrModuleMenu
            groups={navGroups}
            roleLabel={roleLabel}
            pathname={pathname}
            navLabel={navLabel}
            onOpenModule={openModule}
          />
        )}

        <EhrTopActions items={quickActionItems.slice(0, 6)} navLabel={navLabel} onOpenModule={openModule} />
      </nav>

      {/* Hospital name intentionally not shown — this slot stays as a spacer
          so the rail's centre column keeps the layout balanced. */}
      <div aria-hidden className="ehr-top-hospital-name" />

      <button
        type="button"
        className="ehr-top-calendar-button"
        onClick={() => router.push('/dashboard?view=calendar')}
        aria-label="Open calendar"
        title="Calendar"
      >
        <Calendar className="w-4 h-4" />
      </button>

      {canSearchPatients ? (
        <div className={`ehr-top-search ${mobileSearchOpen ? 'is-mobile-open' : ''}`} ref={boxRef}>
          <Search className="w-4 h-4" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setOpen(event.target.value.trim().length >= 2);
            }}
            onFocus={() => setOpen(query.trim().length >= 2)}
            placeholder="Start typing a patient name, ID, or phone"
            type="search"
          />
          {(query || mobileSearchOpen) && (
            <button type="button" onClick={query ? clearSearch : closeMobileSearch} aria-label={query ? 'Clear patient search' : 'Close patient search'}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {open && (
            <div className="ehr-top-search-menu">
              {matches.length === 0 ? (
                <p>No matching patients in this workspace.</p>
              ) : matches.map(patient => (
                <button key={patient._id} type="button" onMouseDown={event => { event.preventDefault(); openPatient(patient._id); }}>
                  <span>
                    <strong>{patientFullName(patient)}</strong>
                    <small>
                      {[patient.hospitalNumber, patientGenderAge(patient), patient.phone ? formatPhoneDisplay(patient.phone) : ''].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="ehr-top-search-spacer" aria-hidden="true" />
      )}

      <div className="ehr-top-actions">
        {canSearchPatients && (
          <button
            type="button"
            className="ehr-mobile-search-trigger"
            onClick={() => {
              setMobileSearchOpen(true);
              setOpen(query.trim().length >= 2);
            }}
            aria-label="Search patients"
          >
            <Search className="w-4 h-4" />
          </button>
        )}
        {canRegisterPatients && (
          <button
            type="button"
            onClick={() => router.push('/patients/new')}
            aria-label={t('frontDesk.registerNewPatient')}
            title={t('frontDesk.registerNewPatient')}
          >
            <UserPlus className="w-4 h-4" />
          </button>
        )}
        <QuickActions />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        <div className="ehr-user-menu-wrap" ref={userRef}>
          <button
            type="button"
            className={`ehr-avatar ehr-avatar--labeled ${userOpen ? 'active' : ''}`}
            title={currentUser?.name || 'Tamam user'}
            onClick={() => setUserOpen(value => !value)}
            aria-expanded={userOpen}
            aria-haspopup="menu"
          >
            <span className="ehr-avatar-mark" style={roleConfig?.color ? { background: roleConfig.color } : undefined}>{initials}</span>
            <span className="ehr-avatar-role">{roleConfig?.badgeLabel || roleLabel}</span>
          </button>

          {userOpen && (
            <div className="ehr-user-menu" role="menu">
              <button type="button" role="menuitem" onClick={openProfilePage}>
                <User className="w-4 h-4" />
                <span>Profile</span>
              </button>
              <button type="button" role="menuitem" onClick={openSettingsPage}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <button type="button" role="menuitem" className="danger" onClick={logout}>
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>

    </header>

    {currentUser && mobileTabs.length > 0 && (
      <nav className="ehr-mobile-tabbar" aria-label="Primary navigation">
        {mobileTabs.slice(0, 2).map(tab => (
          <button
            key={tab.href}
            type="button"
            className={isRouteActive(tab.href) ? 'active' : ''}
            onClick={() => router.push(tab.href)}
          >
            <tab.icon className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}
        {primaryCreateHref && (
          <button type="button" className="ehr-mobile-tabbar-fab" aria-label="Quick create" onClick={() => router.push(primaryCreateHref)}>
            <Plus className="w-6 h-6" />
          </button>
        )}
        {mobileTabs.slice(2).map(tab => (
          <button
            key={tab.href}
            type="button"
            className={isRouteActive(tab.href) ? 'active' : ''}
            onClick={() => router.push(tab.href)}
          >
            <tab.icon className="w-5 h-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    )}
    </>
  );
}
