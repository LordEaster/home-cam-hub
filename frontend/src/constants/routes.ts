/**
 * Application route paths
 * Centralized route definitions for maintainability
 */
export const ROUTES = {
  // Auth
  LOGIN: '/login',

  // Main views
  HOME: '/',
  LIVE_VIEW: '/',
  PLAYBACK: '/playback',
  SETTINGS: '/settings',

  // Admin
  ADMIN: {
    CAMERAS: '/admin/cameras',
    USERS: '/admin/users',
    AUDIT: '/admin/audit',
  },
} as const;

/**
 * Navigation items for sidebar
 */
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: ROUTES.LIVE_VIEW, label: 'Live View', icon: 'monitor' },
  { path: ROUTES.PLAYBACK, label: 'Playback', icon: 'clock' },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { path: ROUTES.ADMIN.CAMERAS, label: 'Cameras', icon: 'camera', adminOnly: true },
  { path: ROUTES.ADMIN.USERS, label: 'Users', icon: 'users', adminOnly: true },
];
