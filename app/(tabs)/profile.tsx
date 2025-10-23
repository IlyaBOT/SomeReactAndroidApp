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

  // Хедер статус
  const headerStats = useMemo(() => {
    if (isCompany) {
      return [
        { label: 'Избранное', value: formatNumber(favorites.length) },
      ];
    }

    return [
      { label: 'Избранное', value: formatNumber(favorites.length) },
    ];
  }, [companyFollowers, companyPosts.length, companyTotalLikes, favorites.length, isCompany, liked.length, session?.following?.length]);


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
          <Image source={{ uri: session.avatar }} style={styles.avatar} />
          <ThemedText type="title" style={styles.displayName}>
            {session.name}
          </ThemedText>
          <Text style={styles.handle}>@{session.handle}</Text>
          <View style={styles.accountTag}>
            <Ionicons name={session.accountType === 'company' ? 'business' : 'person'} size={16} color="#6e0aa4" />
            <Text style={styles.accountTagText}>
              {session.accountType === 'company' ? 'Аккаунт компании' : 'Личный аккаунт'}
            </Text>
          </View>
          <View style={styles.statsRow}>
            {headerStats.map(stat => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
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
