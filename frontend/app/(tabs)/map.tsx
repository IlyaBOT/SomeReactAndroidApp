import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { registerMapSearchHandler } from '@/lib/map-search';
import * as Location from 'expo-location';

import YandexMap, { type YandexMapHandle } from './YandexMap';

type Coordinates = { latitude: number; longitude: number };

const INITIAL_LOCATION: Coordinates = { latitude: 48.0158, longitude: 37.8026 };

export default function MapScreen() {
  const mapRef = useRef<YandexMapHandle>(null);
  const searchInputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(INITIAL_LOCATION);
  const [selectedAddress, setSelectedAddress] = useState<string | undefined>(undefined);
  const [searchActive, setSearchActive] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const hasCenteredInitial = useRef(false);

  const handleLocationSelect = useCallback((coords: { latitude: number; longitude: number }, address?: string) => {
    setSelectedLocation(coords);
    setSelectedAddress(address);
  }, []);

  const performSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    mapRef.current?.searchAddress(trimmed);
    Keyboard.dismiss();
  }, [searchQuery]);

  const openSearch = useCallback(() => {
    setSearchActive(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const handleExternalAction = useCallback((action: { type: 'search'; query?: string } | { type: 'route'; query: string }) => {
    if (action.type === 'search') {
      const trimmed = action.query?.trim();
      if (trimmed) {
        setSearchQuery(trimmed);
        setSearchActive(false);
        requestAnimationFrame(() => {
          mapRef.current?.searchAddress(trimmed);
        });
      } else {
        openSearch();
      }
      return;
    }

    const trimmed = action.query.trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    setSearchActive(false);
    requestAnimationFrame(() => {
      mapRef.current?.buildRoute(trimmed, userLocation ?? undefined);
    });
  }, [openSearch, userLocation]);

  useEffect(() => {
    const unregister = registerMapSearchHandler(handleExternalAction);
    return unregister;
  }, [handleExternalAction]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.warn('Не удалось получить местоположение', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (userLocation && !hasCenteredInitial.current) {
      setSelectedLocation(userLocation);
      setSelectedAddress('Моё местоположение');
      hasCenteredInitial.current = true;
      mapRef.current?.moveToCoordinates(userLocation);
    }
  }, [userLocation]);

  const handleRecenter = () => {
    const target = userLocation ?? selectedLocation;
    mapRef.current?.moveToCoordinates(target);
    setSelectedLocation(target);
  };

  return (
    <View style={styles.root}>
      <YandexMap
        ref={mapRef}
        apiKey="bb90505e-e4be-41cf-b0c1-82ccf1b69041"
        initialLocation={INITIAL_LOCATION}
        onLocationSelect={handleLocationSelect}
      />

      <SafeAreaView pointerEvents="box-none" style={styles.safeOverlay}>
        <View pointerEvents="box-none" style={styles.topOverlay}>
          <View style={[styles.searchContainer, searchActive && styles.searchContainerActive]}>
            <Ionicons name="search" size={18} color="#351f3b" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Поиск по карте..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchActive(true)}
              onBlur={() => setSearchActive(false)}
              onSubmitEditing={performSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={performSearch} style={styles.searchAction} activeOpacity={0.85}>
              <Ionicons name="arrow-forward-circle" size={22} color="#cf3abb" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View pointerEvents="box-none" style={styles.bottomOverlay}>
        <View style={styles.infoPanel}>
          {selectedAddress ? (
            <>
              <View style={styles.infoRow}>
                <Ionicons name="navigate-outline" size={18} color="#cf3abb" />
                <Text style={styles.infoLabel}>Адрес</Text>
              </View>
              <Text style={styles.infoValue}>{selectedAddress}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000ff',
  },
  safeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    gap: 10,
    width: '100%',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginTop: 32
  },
  searchContainerActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: '#0f172a',
  },
  clearButton: {
    padding: 2,
  },
  searchAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
    alignItems: 'flex-end',
    gap: 16,
  },
  infoPanel: {
    alignSelf: 'stretch',
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(53, 31, 59, 1)',
    gap: 8,
    marginBottom:64
  }, 
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 14,
    color: '#f8fafc',
    lineHeight: 20,
  },
  myLocationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#cf3abb',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
