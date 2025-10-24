import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { formatCompactNumber, normalizePost, posts } from '@/constants/content';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  clearUserSession,
  enrichPostsByIds,
  getUserSession,
  type UserSession,
} from '@/lib/user-session';
import styles from './css/StylesProfile';

export default function ProfileScreen() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(getUserSession());

  useFocusEffect(
    useCallback(() => {
      const nextSession = getUserSession();
      if (!nextSession) {
        router.replace('/login');
        return;
      }
      setSession(nextSession);
    }, [router])
  );

  const sessionHandle = session?.handle ?? '';
  const isCompany = session?.accountType === 'company';

  const favorites = useMemo(
    () => enrichPostsByIds(session?.favorites ?? [], posts),
    [session]
  );
  const liked = useMemo(
    () => enrichPostsByIds(session?.liked ?? [], posts),
    [session]
  );
  const companyPosts = useMemo(
    () =>
      isCompany
        ? posts
            .filter(post => post.userHandle === sessionHandle)
            .map(normalizePost)
        : [],
    [isCompany, sessionHandle]
  );
  const companyFollowers = companyPosts[0]?.followers ?? 0;
  const companyTotalLikes = companyPosts.reduce((sum, post) => sum + post.totalLikes, 0);

  const handleLogout = () => {
    clearUserSession();
    setSession(null);
    router.replace('/login');
  };

  if (!session) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <ThemedText type="title" style={styles.displayName}>
            Здравствуйте, {session.name}!
          </ThemedText>
          <View style={styles.accountTag}>
            <Ionicons name={session.accountType === 'company' ? 'business' : 'mail'} size={16} color="#6e0aa4" />
            <Text style={styles.accountTagText}>
              {session.accountType === 'company' ? 'Аккаунт компании' : session.handle}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.logoutText}>Выйти из аккаунта</Text>
          </TouchableOpacity>
        </View>

        {isCompany ? (
          // Компания
          <>
          </>
        ) : (
          // Если не компания
          <>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}





function formatNumber(value: number) {
  return formatCompactNumber(value);
}
