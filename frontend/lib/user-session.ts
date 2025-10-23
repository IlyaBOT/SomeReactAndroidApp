import type { Post } from '@/constants/content';

export type UserSession = {
  id: string;
  name: string;
  email: string;
  handle: string;
  avatar: string;
  accountType: 'user' | 'company';
  favorites: string[]; // Post IDs
  liked: string[]; // Post IDs
  following: Array<{
    id: string;
    name: string;
    handle: string;
    avatar: string;
    description: string;
  }>;
};

type GlobalWithSession = typeof globalThis & {
  __CITY_GUIDE_USER__?: UserSession;
};

export function setUserSession(session: UserSession) {
  (globalThis as GlobalWithSession).__CITY_GUIDE_USER__ = session;
}

export function getUserSession(): UserSession | null {
  return ((globalThis as GlobalWithSession).__CITY_GUIDE_USER__ ?? null);
}

export function clearUserSession() {
  if ('__CITY_GUIDE_USER__' in (globalThis as GlobalWithSession)) {
    delete (globalThis as GlobalWithSession).__CITY_GUIDE_USER__;
  }
}

export function enrichPostsByIds(ids: string[], allPosts: Post[]): Post[] {
  const set = new Set(ids);
  return allPosts.filter(post => set.has(post.id));
}
