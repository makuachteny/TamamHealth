'use client';

import { useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DuotoneSettings as Settings,
  DuotoneLogout as LogOut,
  DuotoneGlobe as Globe,
  DuotoneBuilding as Building2,
  DuotoneClose as X,
  DuotoneChevronLeft as ChevronsLeft,
  DuotoneChevronRight as ChevronsRight,
  DuotoneCheck as Check,
} from '@/components/icons';
import { useApp } from '@/lib/context';
import { getRoleConfig } from '@/lib/permissions';
import type { NavItem } from '@/lib/permissions';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SUPPORTED_LOCALES } from '@/lib/i18n';

function groupBySection(items: NavItem[]): { section: string | null; items: NavItem[] }[] {
  const groups: { section: string | null; items: NavItem[] }[] = [];
  let current: { section: string | null; items: NavItem[] } | null = null;

  for (const item of items) {
    const sec = item.section || null;
    if (!current || current.section !== sec) {
      current = { section: sec, items: [item] };
      groups.push(current);
    } else {
      current.items.push(item);
    }
  }
  return groups;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, currentUser, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { t, locale, setLocale } = useTranslation();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const currentLocaleConfig = SUPPORTED_LOCALES.find(l => l.code === locale);

  // Map nav hrefs to i18n keys — falls back to the original label if no key exists
  const navLabel = (item: NavItem): string => {
    const keyMap: Record<string, string> = {
      '/dashboard': 'nav.dashboard', '/patients': 'nav.patients', '/consultation': 'nav.consultation',
      '/appointments': 'nav.appointments', '/referrals': 'nav.referrals', '/lab': 'nav.lab',
      '/pharmacy': 'nav.pharmacy', '/immunizations': 'nav.immunizations', '/anc': 'nav.anc',
      '/births': 'nav.births', '/deaths': 'nav.deaths', '/surveillance': 'nav.surveillance',
      '/hospitals': 'nav.hospitals', '/reports': 'nav.reports', '/messages': 'nav.messages',
      '/settings': 'nav.settings', '/telehealth': 'nav.telehealth', '/government': 'nav.government',
    };
    const key = keyMap[item.href];
    if (key) {
      const translated = t(key);
      if (translated !== key) return translated; // translation found
    }
    return item.label; // fallback to original
  };

  const role = currentUser?.role;
  const isAdminLevel = role === 'super_admin' || role === 'org_admin' || role === 'government';
  const canChangeLang = role === 'super_admin' || role === 'org_admin' || role === 'government' || role === 'medical_superintendent';
  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;
  const navItems = roleConfig?.navItems || [];
  const groups = groupBySection(navItems);
  const hasSections = navItems.some(i => i.section);

  const branding = currentUser?.branding;
  // The top of the sidebar is the product brand. The org/facility identity is
  // shown exactly once in the user card below, so it must not be repeated here.
  const brandName = 'Tamam Healthcare System';
  const brandLogo = branding?.logoUrl;

  const handleNavClick = () => {
    setSidebarOpen(false);
    setShowLangPicker(false);
  };

  const collapsed = sidebarCollapsed;

  // Drag-to-collapse/expand
  const dragRef = useRef<{ startX: number; startWidth: number; dragging: boolean }>({ startX: 0, startWidth: 256, dragging: false });
  const sidebarRef = useRef<HTMLElement>(null);

  const handleDragStart = useCallback((clientX: number) => {
    dragRef.current = {
      startX: clientX,
      startWidth: collapsed ? 80 : 256,
      dragging: true,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [collapsed]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!dragRef.current.dragging) return;
    const delta = clientX - dragRef.current.startX;
    const newWidth = dragRef.current.startWidth + delta;
    // Threshold: if dragged below 140px, collapse; above 140px, expand
    if (sidebarRef.current) {
      sidebarRef.current.style.transition = 'none';
      sidebarRef.current.style.width = `${Math.max(64, Math.min(280, newWidth))}px`;
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (sidebarRef.current) {
      const currentWidth = sidebarRef.current.getBoundingClientRect().width;
      sidebarRef.current.style.transition = '';
      if (currentWidth < 140) {
        setSidebarCollapsed(true);
        sidebarRef.current.style.width = '';
      } else {
        setSidebarCollapsed(false);
        sidebarRef.current.style.width = '';
      }
    }
  }, [setSidebarCollapsed]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
    const onMouseMove = (ev: MouseEvent) => handleDragMove(ev.clientX);
    const onMouseUp = () => {
      handleDragEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [handleDragStart, handleDragMove, handleDragEnd]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
    const onTouchMove = (ev: TouchEvent) => handleDragMove(ev.touches[0].clientX);
    const onTouchEnd = () => {
      handleDragEnd();
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  }, [handleDragStart, handleDragMove, handleDragEnd]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`pt-5 pb-4 ${collapsed ? 'px-2' : 'px-5'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brandLogo || '/assets/tamamhealth-logo.svg'}
            alt={brandName}
            className="flex-shrink-0 object-contain"
            style={{ width: collapsed ? 32 : 36, height: collapsed ? 32 : 36 }}
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-extrabold text-[15px] leading-[1.12]" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {brandName}
              </h1>
            </div>
          )}
          {/* Close button - only on mobile/tablet */}
          {!collapsed && (
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-2 rounded-xl transition-all hover:scale-105 min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ background: 'var(--overlay-subtle)' }}
            >
              <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* User role & facility */}
      {currentUser && !collapsed && (
        <div className="mx-4 mb-3 p-3 rounded-xl" style={{
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border-medium)',
        }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{
              background: 'linear-gradient(135deg, var(--accent-light) 0%, transparent 100%)',
              border: '1px solid var(--accent-border)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
            }}>
              {isAdminLevel
                ? <Globe className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                : <Building2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {role === 'super_admin' ? 'Platform Administrator'
                  : role === 'government' ? 'Government Admin'
                  : role === 'org_admin' ? 'Organization Admin'
                  : roleConfig?.label || 'Staff'}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {role === 'super_admin' ? 'All Organizations'
                  : role === 'government' ? 'Ministry of Health'
                  : role === 'org_admin' ? (currentUser.organization?.name || 'My Organization')
                  : (currentUser.hospital?.name || currentUser.hospitalName || 'Unassigned')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Main navigation" className={`flex-1 mt-1 overflow-y-auto overflow-x-hidden no-scrollbar ${collapsed ? 'px-2' : 'px-3'}`}>
        {hasSections ? (
          groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {group.section && !collapsed && (
                <p className="px-3 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                  {group.section}
                </p>
              )}
              {group.section && collapsed && (
                <div className="w-6 h-px mx-auto my-2" style={{ background: 'var(--border-medium)' }} />
              )}
              <div className="space-y-1">
                {group.items.map(item => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      title={collapsed ? navLabel(item) : undefined}
                      className={`nav-item ${isActive ? 'nav-item-active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`}
                    >
                      <item.icon className="w-[22px] h-[22px] flex-shrink-0" style={{ opacity: isActive ? 1 : 0.7 }} />
                      {!collapsed && <span className="font-medium text-[13px]">{navLabel(item)}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-1">
            {navItems.map(item => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  title={collapsed ? item.label : undefined}
                  className={`nav-item ${isActive ? 'nav-item-active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`}
                >
                  <item.icon className="w-[22px] h-[22px] flex-shrink-0" style={{ opacity: isActive ? 1 : 0.7 }} />
                  {!collapsed && <span className="font-medium text-[13px]">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className={`pb-2 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* Collapse toggle - desktop only */}
        <button
          onClick={() => setSidebarCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex nav-item w-full text-left items-center"
          style={{ color: 'var(--nav-text)' }}
        >
          {collapsed ? (
            <ChevronsRight className="w-[17px] h-[17px] mx-auto" />
          ) : (
            <>
              <ChevronsLeft className="w-[22px] h-[22px]" />
              <span className="text-[13px]">Collapse</span>
            </>
          )}
        </button>

        {/* Language picker — only for org admin / hospital heads */}
        {canChangeLang && (
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              title={collapsed ? `Language: ${currentLocaleConfig?.nativeName || 'English'}` : undefined}
              className={`nav-item w-full text-left ${collapsed ? 'justify-center !px-0' : ''}`}
              style={{ color: 'var(--nav-text)' }}
            >
              <Globe className="w-[22px] h-[22px]" style={{ opacity: 0.7 }} />
              {!collapsed && (
                <span className="text-[13px] flex-1">{currentLocaleConfig?.nativeName || 'English'}</span>
              )}
            </button>
            {showLangPicker && (
              <div
                className="absolute left-0 bottom-full mb-1 rounded-xl overflow-hidden"
                style={{
                  background: 'var(--bg-card-solid)',
                  border: '1px solid var(--border-medium)',
                  boxShadow: 'var(--card-shadow-lg)',
                  width: collapsed ? '220px' : '100%',
                  zIndex: 100,
                  maxHeight: '320px',
                  overflowY: 'auto',
                }}
              >
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Language</p>
                </div>
                {SUPPORTED_LOCALES.map(loc => (
                  <button
                    key={loc.code}
                    onClick={async () => {
                      await setLocale(loc.code);
                      // Persist to organization so all facility users get this language
                      if (currentUser?.orgId) {
                        try {
                          const { updateOrganization } = await import('@/lib/services/organization-service');
                          await updateOrganization(currentUser.orgId, { locale: loc.code });
                        } catch { /* offline — will sync later */ }
                      }
                      setShowLangPicker(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
                    style={{
                      background: loc.code === locale ? 'var(--accent-light)' : 'transparent',
                      color: loc.code === locale ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                  >
                    <span className="text-sm font-medium flex-1">{loc.nativeName}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{loc.region || ''}</span>
                    {loc.code === locale && <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {roleConfig?.allowedRoutes?.includes('/settings') && (
          <Link
            href="/settings"
            onClick={handleNavClick}
            title={collapsed ? t('nav.settings') : undefined}
            className={`nav-item ${pathname === '/settings' ? 'nav-item-active' : ''} ${collapsed ? 'justify-center !px-0' : ''}`}
          >
            <Settings className="w-[22px] h-[22px]" style={{ opacity: pathname === '/settings' ? 1 : 0.7 }} />
            {!collapsed && <span className="font-medium text-[13px]">{t('nav.settings')}</span>}
          </Link>
        )}

        <button
          onClick={() => { setSidebarOpen(false); logout(); }}
          aria-label="Sign Out"
          className={`nav-item w-full text-left ${collapsed ? 'justify-center !px-0' : ''}`}
          style={{ color: 'var(--nav-text)' }}
        >
          <LogOut className="w-[22px] h-[22px]" />
          {!collapsed && <span className="text-[13px]">{t('auth.logout')}</span>}
        </button>
      </div>

      {/* User profile card */}
      {currentUser && !collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-2xl" style={{
          background: 'var(--overlay-subtle)',
          border: '1px solid var(--border-medium)',
        }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{
              background: `var(--accent-primary)`,
              boxShadow: `0 2px 8px var(--accent-primary)`,
            }}>
              {(currentUser.name || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{currentUser.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{roleConfig?.badgeLabel || currentUser.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed user avatar */}
      {currentUser && collapsed && (
        <div className="flex justify-center mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{
            background: `var(--accent-primary)`,
            boxShadow: `0 2px 8px var(--accent-primary)`,
          }}
          title={currentUser.name}
          >
            {(currentUser.name || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || '?'}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar — solid floating panel */}
      <aside
        ref={sidebarRef}
        className="hidden lg:flex fixed left-0 top-0 bottom-0 flex-col z-40 overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          width: collapsed ? '80px' : '256px',
          margin: '12px',
          marginRight: '0',
          height: 'calc(100vh - 24px)',
          background: 'var(--sidebar-bg)',
          borderRadius: '10px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--panel-shadow)',
        }}
      >
        {sidebarContent}
        {/* Drag handle on right edge */}
        <div
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group"
          style={{ borderRadius: '0 10px 10px 0' }}
        >
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: roleConfig?.color || 'var(--accent-primary)' }}
          />
        </div>
      </aside>

      {/* Mobile/Tablet drawer backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile/Tablet drawer — always expanded */}
      <aside
        className={`lg:hidden fixed left-0 top-0 bottom-0 flex flex-col z-50 overflow-hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: '280px',
          margin: '8px',
          height: 'calc(100vh - 16px)',
          background: 'var(--sidebar-bg)',
          borderRadius: '10px',
          border: '1px solid var(--border-medium)',
          boxShadow: sidebarOpen ? 'var(--card-shadow-xl)' : 'none',
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
