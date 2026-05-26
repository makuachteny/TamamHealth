'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DuotoneBell as Bell,
  DuotoneSearch as Search,
  DuotoneMoon as Moon,
  DuotoneSun as Sun,
  DuotoneMenu as Menu,
  DuotoneUser as UserIcon,
  DuotoneArrowRight as ArrowRight,
} from '@/components/icons';
import SyncStatusBadge from '@/components/SyncStatusBadge';
import { useApp } from '@/lib/context';
import { usePatients } from '@/lib/hooks/usePatients';
import { getRoleConfig } from '@/lib/permissions';

export default function TopBar({ hideSearch }: { title?: string; hideSearch?: boolean }) {
  const { currentUser, theme, toggleTheme, globalSearch, setGlobalSearch, setSidebarOpen } = useApp();
  const [localSearch, setLocalSearch] = useState(globalSearch);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { patients } = usePatients();
  const roleConfig = currentUser ? getRoleConfig(currentUser.role) : null;

  const handleSearch = useCallback((value: string) => {
    setLocalSearch(value);
    setDropdownOpen(value.trim().length >= 2);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setGlobalSearch(value), 300);
  }, [setGlobalSearch]);

  // Live patient quick-jump matches (top 6) — gives the TopBar real
  // cross-module search instead of just narrowing the current list.
  const patientMatches = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return (patients || [])
      .filter(p =>
        `${p.firstName || ''} ${p.surname || ''}`.toLowerCase().includes(q) ||
        (p.hospitalNumber || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q)
      )
      .slice(0, 6);
  }, [localSearch, patients]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [dropdownOpen]);

  const jumpToPatient = (id: string) => {
    setDropdownOpen(false);
    setLocalSearch('');
    setGlobalSearch('');
    router.push(`/patients/${id}`);
  };

  // Shared icon-button style
  const iconBtn = "w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative";

  return (
    <header
      className="h-[60px] flex items-center justify-between px-4 sm:px-5 z-30 mx-3 flex-shrink-0"
      style={{
        background: 'var(--bg-card-solid)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger menu - visible on mobile/tablet */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          className={`lg:hidden ${iconBtn} -ml-1`}
          style={{ background: 'var(--overlay-subtle)' }}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Search */}
        {!hideSearch && (
          <div className="relative hidden sm:block" ref={searchContainerRef}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              placeholder="Search by name, ID, or record..."
              value={localSearch}
              onChange={e => handleSearch(e.target.value)}
              onFocus={e => {
                e.currentTarget.style.width = '340px';
                if (localSearch.trim().length >= 2) setDropdownOpen(true);
              }}
              onBlur={e => { e.currentTarget.style.width = '260px'; }}
              className="search-icon-input pr-4 py-2.5 text-sm"
              style={{
                width: '260px',
                border: '1px solid var(--border-medium)',
                background: 'var(--overlay-subtle)',
                fontSize: '0.82rem',
                color: 'var(--text-primary)',
                transition: 'width 0.3s ease, box-shadow 0.2s ease',
                borderRadius: 'var(--input-radius)',
              }}
            />

            {/* Quick-jump dropdown */}
            {dropdownOpen && localSearch.trim().length >= 2 && (
              <div
                className="absolute top-full left-0 mt-1.5 rounded-xl overflow-hidden z-50"
                style={{
                  width: 360,
                  background: 'var(--bg-card-solid)',
                  border: '1px solid var(--border-medium)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.06)',
                }}
              >
                {patientMatches.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      No patient matches for &ldquo;{localSearch}&rdquo;
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Try searching by hospital number or phone
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                      Patients ({patientMatches.length})
                    </div>
                    {patientMatches.map(p => (
                      <button
                        key={p._id}
                        onMouseDown={(e) => { e.preventDefault(); jumpToPatient(p._id); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--overlay-subtle)]"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: 'var(--accent-primary)' }}
                        >
                          {(p.firstName || '?')[0]}{(p.surname || '?')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {p.firstName} {p.surname}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                            {p.hospitalNumber} · {p.gender}
                            {p.estimatedAge ? ` · ${p.estimatedAge}y` : ''}
                            {p.phone ? ` · ${p.phone}` : ''}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    ))}
                    <div className="px-3 py-2 text-[10px]" style={{ color: 'var(--text-muted)', background: 'var(--overlay-subtle)' }}>
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        Press Enter to filter the current page
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile search button */}
        {!hideSearch && (
          <button
            aria-label="Search patients and records"
            className={`sm:hidden ${iconBtn}`}
            style={{ background: 'var(--overlay-subtle)' }}
            onClick={() => {
              const val = prompt('Search patients, records...');
              if (val !== null) handleSearch(val);
            }}
          >
            <Search className="w-[22px] h-[22px]" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className={iconBtn}
          style={{ background: 'transparent' }}
        >
          {theme === 'light' ? (
            <Moon className="w-[22px] h-[22px]" />
          ) : (
            <Sun className="w-[22px] h-[22px]" />
          )}
        </button>

        {/* Sync status — animated pill with popover for pause/resume + sync now */}
        <SyncStatusBadge />

        {/* Notifications */}
        <button
          aria-label="Notifications"
          className={`relative ${iconBtn}`}
          style={{ background: 'transparent' }}
        >
          <Bell className="w-[22px] h-[22px]" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full" aria-hidden="true" style={{
            background: 'var(--accent-primary)',
            boxShadow: '0 0 4px var(--accent-light)',
          }} />
        </button>

        {/* Role badge */}
        {roleConfig && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{
            background: 'var(--accent-light)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--accent-border)',
          }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" aria-hidden="true" style={{ background: roleConfig.color }} />
            <span>{currentUser?.organization?.name || roleConfig.badgeLabel}</span>
          </div>
        )}

        {/* User avatar */}
        {currentUser && (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{
            background: 'var(--accent-primary)',
          }}>
            {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        )}
      </div>
    </header>
  );
}
