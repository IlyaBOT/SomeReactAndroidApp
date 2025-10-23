import { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  posts as sourcePosts,
  normalizePosts,
  formatCompactNumber,
  type NormalizedPost
} from '@/constants/content';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { triggerMapRoute, triggerMapSearch } from '@/lib/map-search';

type NearbyPost = NormalizedPost;

const allPostsNormalized = normalizePosts(sourcePosts);

const categoryOptions = (() => {
  const unique = new Map<string, string>();
  for (const post of allPostsNormalized) {
    for (const tag of post.tags) {
      const key = tag.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, tag);
      }
    }
  }
  return [
    { id: 'all', name: 'Все', icon: 'apps' as const },
    ...Array.from(unique.entries()).map(([id, name]) => ({ id, name, icon: 'pricetag-outline' as const }))
  ];
})();

export default function NearbyScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [postsData, setPostsData] = useState<NearbyPost[]>(allPostsNormalized);
  const [visiblePosts, setVisiblePosts] = useState<NearbyPost[]>(allPostsNormalized);
  const [activePost, setActivePost] = useState<NearbyPost | null>(null);
  const [isDetailVisible, setDetailVisible] = useState(false);

  const filterPosts = useCallback((data: NearbyPost[], category: string) => {
    if (category === 'all') {
      return data;
    }
    return data.filter(post => post.tags.some(tag => tag.toLowerCase() === category));
  }, []);

  const applyFilter = useCallback((category: string) => {
    const filtered = filterPosts(postsData, category);
    setVisiblePosts(filtered);
  }, [filterPosts, postsData]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    applyFilter(categoryId);
  };

  const handleLike = (uid: string) => {
    setPostsData(prev => prev.map(post => (post.uid === uid ? { ...post, likes: post.likes + 1 } : post)));
    setVisiblePosts(prev => prev.map(post => (post.uid === uid ? { ...post, likes: post.likes + 1 } : post)));
  };

  const openInMap = (post: NearbyPost) => {
    router.push('/map');
    triggerMapSearch(post.address);
  };

  const buildRoute = (post: NearbyPost) => {
    router.push('/map');
    triggerMapRoute(post.address);
  };

  const handleOpenDetail = (post: NearbyPost) => {
    setActivePost(post);
    setDetailVisible(true);
  };

  const handleCloseDetail = () => {
    setDetailVisible(false);
  };

  const renderPost = ({ item }: { item: NearbyPost }) => (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.post}
      onPress={() => handleOpenDetail(item)}
    >
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.info}>
        <View style={styles.authorRow}>
          <TouchableOpacity activeOpacity={0.8}>
            <Image source={{ uri: item.userAvatar }} style={styles.authorAvatar} />
          </TouchableOpacity>
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{item.user}</Text>
            <Text style={styles.authorHandle}>@{item.userHandle}</Text>
          </View>
        </View>
        <View style={styles.placeRow}>
          <Text style={styles.place}>{item.place}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={16} color="#FFB800" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.userCaption}>от {item.user}</Text>
        <TouchableOpacity
          style={styles.addressRow}
          activeOpacity={0.85}
          onPress={() => openInMap(item)}
        >
          <Ionicons name="location-outline" size={16} color="#2563eb" />
          <Text style={styles.addressText}>{item.address}</Text>
        </TouchableOpacity>
        <View style={styles.tagRow}>
          {item.tags.map(tag => (
            <View key={`${item.uid}-${tag}`} style={styles.tagChip}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.actionGroup}>
          <TouchableOpacity
            onPress={() => handleLike(item.uid)}
            style={styles.likeBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="heart-outline" size={24} color="#FF2D55" />
            <Text style={styles.likeCount}>{formatCompactNumber(item.likes)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => buildRoute(item)}
            style={styles.actionButton}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate-outline" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={24} color="#1C1C1E" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.actionButton, styles.favoriteButton]} activeOpacity={0.85}>
          <Ionicons name="bookmark-outline" size={24} color="#1C1C1E" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ThemedText type="title" style={styles.title}>
            Закладки
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            
          </ThemedText>
        </View>

        <FlatList
          horizontal
          data={categoryOptions}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.categoryChip, selectedCategory === item.id && styles.categoryChipActive]}
              onPress={() => handleCategorySelect(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={selectedCategory === item.id ? '#fff' : '#2563eb'}
              />
              <Text style={selectedCategory === item.id ? styles.categoryChipTextActive : styles.categoryChipText}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={visiblePosts}
        keyExtractor={item => item.uid}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color="#c6c6c8" />
            <ThemedText type="defaultSemiBold" style={styles.emptyTitle}>
              Ничего не найдено
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              Попробуйте выбрать другую категорию
            </ThemedText>
          </View>
        }
      />

      <Modal
        visible={isDetailVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDetail}
      >
        <Pressable style={styles.detailOverlay} onPress={handleCloseDetail}>
          {activePost && (
            <Pressable style={styles.detailCard} onPress={event => event.stopPropagation()}>
              <Image source={{ uri: activePost.image }} style={styles.detailImage} />
              <View style={styles.detailContent}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{activePost.place}</Text>
                  <View style={styles.detailRating}>
                    <Ionicons name="star" size={18} color="#FFB800" />
                    <Text style={styles.detailRatingText}>{activePost.rating.toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.detailSubtitle}>{activePost.user}</Text>
                <TouchableOpacity
                  style={styles.detailAddressRow}
                  activeOpacity={0.85}
                  onPress={() => {
                    handleCloseDetail();
                    openInMap(activePost);
                  }}
                >
                  <Ionicons name="location-outline" size={18} color="#2563eb" />
                  <Text style={styles.detailAddressText}>{activePost.address}</Text>
                </TouchableOpacity>
                <View style={styles.detailTags}>
                  {activePost.tags.map(tag => (
                    <View key={`${activePost.uid}-detail-${tag}`} style={styles.detailTagChip}>
                      <Text style={styles.detailTagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.detailDescription}>
                  {activePost.reviews[0]?.comment ??
                    'Здесь вы найдете лучшие впечатления города: маршруты, атмосферные пространства и события рядом.'}
                </Text>
                <View style={styles.detailMetaRow}>
                  <TouchableOpacity
                    style={styles.detailMeta}
                    activeOpacity={0.85}
                    onPress={() => {
                      handleCloseDetail();
                      openInMap(activePost);
                    }}
                  >
                    <Ionicons name="map-outline" size={18} color="#1e293b" />
                    <Text style={styles.detailMetaText}>На карте</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailMeta}
                    activeOpacity={0.85}
                    onPress={() => {
                      handleCloseDetail();
                      buildRoute(activePost);
                    }}
                  >
                    <Ionicons name="navigate-outline" size={18} color="#1e293b" />
                    <Text style={styles.detailMetaText}>Маршрут</Text>
                  </TouchableOpacity>
                  <View style={styles.detailMeta}>
                    <Ionicons name="heart-outline" size={18} color="#FF2D55" />
                    <Text style={styles.detailMetaText}>{`${formatCompactNumber(activePost.likes)} отметок`}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
    gap: 16,
  },
  headerTop: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  categoriesList: {
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#cf3abbff',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cf3abbff',
  },
  categoryChipTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 200,
    gap: 20,
  },
  post: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  image: {
    width: '100%',
    height: 220,
  },
  info: {
    padding: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  authorHandle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  place: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 184, 0, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B45309',
  },
  userCaption: {
    color: '#777',
    marginTop: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  favoriteButton: {
    marginLeft: 'auto',
  },
  likeCount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
    color: '#475569',
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 15, 26, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  detailCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    shadowColor: '#0f172a',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 20,
  },
  detailImage: {
    width: '100%',
    height: 260,
  },
  detailContent: {
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 14,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  detailRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 184, 0, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detailRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  detailSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  detailAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  detailAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  detailTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailTagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  detailTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  detailDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1f2937',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  detailMetaText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
  },
});
