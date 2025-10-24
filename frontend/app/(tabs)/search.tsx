import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
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
import styles from './css/StylesSearch';

type SearchPost = NormalizedPost;

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

export default function SearchScreen() {
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [postsData, setPostsData] = useState<SearchPost[]>(allPostsNormalized);
  const [searchResults, setSearchResults] = useState<SearchPost[]>(allPostsNormalized);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [activePost, setActivePost] = useState<SearchPost | null>(null);
  const [isDetailVisible, setDetailVisible] = useState(false);

  const filterPosts = useCallback((data: SearchPost[], category: string, query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.filter(post => {
      const matchesCategory =
        category === 'all' || post.tags.some(tag => tag.toLowerCase() === category);

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        post.place,
        post.user,
        post.address,
        post.bio,
        ...post.tags
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, []);

  useEffect(() => {
    const filtered = filterPosts(postsData, selectedCategory, searchQuery);
    setSearchResults(filtered);
    Animated.timing(fadeAnim, {
      toValue: filtered.length > 0 ? 1 : 0,
      duration: filtered.length > 0 ? 300 : 200,
      useNativeDriver: true,
    }).start();
  }, [postsData, selectedCategory, searchQuery, fadeAnim, filterPosts]);

  useEffect(() => {
    setIsSearching(searchQuery.trim().length > 0);
  }, [searchQuery]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const clearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const openInMap = (post: SearchPost) => {
    router.push('/map');
    triggerMapSearch(post.address);
  };

  const buildRoute = (post: SearchPost) => {
    router.push('/map');
    triggerMapRoute(post.address);
  };

  const handleLike = (uid: string) => {
    setPostsData(prev => prev.map(post => (post.uid === uid ? { ...post, likes: post.likes + 1 } : post)));
  };

  const handleOpenDetail = (post: SearchPost) => {
    setActivePost(post);
    setDetailVisible(true);
  };

  const handleCloseDetail = () => {
    setDetailVisible(false);
  };

  const renderPost = ({ item }: { item: SearchPost }) => (
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
          <Ionicons name="location-outline" size={16} color="#cf3abb" />
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
      <View style={styles.searchHeader}>
        <View style={[styles.searchContainer, searchActive && styles.searchContainerActive]}>
          <Ionicons name="search" size={20} color="#475569" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Поиск мест, событий, авторов..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setSearchActive(true)}
            onBlur={() => setSearchActive(false)}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
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
                color={selectedCategory === item.id ? '#fff' : '#cf3abb'}
              />
              <Text style={selectedCategory === item.id ? styles.categoryChipTextActive : styles.categoryChipText}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <Animated.View style={[styles.resultsContainer, { opacity: fadeAnim }]}>
        <FlatList
          data={searchResults}
          keyExtractor={item => item.uid}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color="#c6c6c8" />
              <ThemedText type="defaultSemiBold" style={styles.emptyTitle}>
                Ничего не найдено
              </ThemedText>
              <ThemedText style={styles.emptyText}>
                Попробуйте изменить запрос или выбрать другую категорию
              </ThemedText>
            </View>
          }
        />
      </Animated.View>

      <View pointerEvents="none" style={styles.placeholderWrapper}>
        {!isSearching && searchResults.length === postsData.length && (
          <View style={styles.placeholderContainer}>
            <Ionicons name="search" size={48} color="#c6c6c8" />
            <ThemedText type="defaultSemiBold" style={styles.placeholderTitle}>
              Найдите интересные места
            </ThemedText>
            <ThemedText style={styles.placeholderText}>
              Ищите рестораны, парки, музеи и другие места вокруг вас
            </ThemedText>
          </View>
        )}
      </View>

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
                  <Ionicons name="location-outline" size={18} color="#cf3abb" />
                  <Text style={styles.detailAddressText}>{activePost.address}</Text>
                </TouchableOpacity>
                <View style={styles.detailTags}>
                  {activePost.tags.map(tag => (
                    <View key={`${activePost.id}-detail-${tag}`} style={styles.detailTagChip}>
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
                      if (!activePost) return;
                      handleCloseDetail();
                      triggerMapSearch(activePost.address);
                    }}
                  >
                    <Ionicons name="map-outline" size={18} color="#1e293b" />
                    <Text style={styles.detailMetaText}>На карте</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.detailMeta}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (!activePost) return;
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

