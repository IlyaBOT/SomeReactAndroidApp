import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerMapSearch } from '@/lib/map-search';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type TabConfig = {
  name: string;
  label: string;
  iconFocused: IoniconName;
  iconDefault: IoniconName;
  position: 'left' | 'center' | 'right';
  variation?: 'primary';
};

const TAB_CONFIG: TabConfig[] = [

  {
    name: 'map',
    label: 'Карта',
    iconFocused: 'map',
    iconDefault: 'map-outline',
    position: 'left'
  },
  {
    name: 'profile',
    label: 'Профиль',
    iconFocused: 'person',
    iconDefault: 'person-outline',
    position: 'center'
  },
  {
    name: 'nearby',
    label: 'Рядом',
    iconFocused: 'location',
    iconDefault: 'location-outline',
    position: 'right'
  }
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="map" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="nearby" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentRouteName = state.routes[state.index]?.name;
  const isMapActive = currentRouteName === 'map';

  const renderTabButton = (tab: TabConfig) => {
    const route = state.routes.find(r => r.name === tab.name);
    if (!route) return null;

    const routeIndex = state.routes.findIndex(r => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const iconName: IoniconName = isFocused ? tab.iconFocused : tab.iconDefault;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (tab.name === 'search' && isMapActive) {
        triggerMapSearch();
        return;
      }

      if (!isFocused && !event.defaultPrevented) {
        if (tab.name === 'profile') {
          const isGuest = !(globalThis as { __CITY_GUIDE_USER__?: unknown }).__CITY_GUIDE_USER__;
          if (isGuest) {
            router.push('/login');
            return;
          }
        }
        navigation.navigate(tab.name as never);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    // Центральная кнопка поиска (широкая)
    if (tab.position === 'center') {
      return (
        <TouchableOpacity
          key={tab.name}
          style={[
            styles.searchButton,
            tab.variation === 'primary' && styles.primarySearchButton,
            isFocused && styles.searchButtonActive
          ]}
          onPress={onPress}
          onLongPress={onLongPress}
          activeOpacity={0.85}
        >
          <View style={styles.searchButtonContent}>
            <Ionicons 
              name={iconName} 
              size={20} 
              color={tab.variation === 'primary' ? '#fff' : '#fdfdfdff'} 
            />
            <Text style={[
              styles.searchButtonText,
              tab.variation === 'primary' ? styles.searchButtonTextPrimary : styles.searchButtonTextSecondary
            ]}>
              {tab.label}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Обычные иконки (главная, профиль, рядом)
    return (
      <TouchableOpacity
        key={tab.name}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.iconButton, isFocused && styles.iconButtonActive]}
      >
        <Ionicons 
          name={iconName} 
          size={24} 
          color={isFocused ? '#cf3abbff' : '#9E9E9E'} 
        />
      </TouchableOpacity>
    );
  };

  // Группируем табы по позициям
  const leftTabs = TAB_CONFIG.filter(tab => tab.position === 'left');
  const centerTabs = TAB_CONFIG.filter(tab => tab.position === 'center');
  const rightTabs = TAB_CONFIG.filter(tab => tab.position === 'right');

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.islandShadow, isMapActive && styles.mapIslandShadow]}>
        <BlurView intensity={isMapActive ? 35 : 70} tint="light" style={styles.islandBlur}>
          <View style={[styles.islandOverlay, isMapActive && styles.mapIslandOverlay]} />
          <View style={styles.islandContent}>
            {/* Левая группа: Главная */}
            <View style={styles.leftGroup}>
              {leftTabs.map(renderTabButton)}
            </View>

            {/* Центральная группа: Поиск */}
            <View style={styles.centerGroup}>
              {centerTabs.map(renderTabButton)}
            </View>

            {/* Правая группа: Профиль и Рядом */}
            <View style={styles.rightGroup}>
              {rightTabs.map(renderTabButton)}
            </View>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -26,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  islandShadow: {
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 18 },
  },
  mapIslandShadow: {
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  islandBlur: {
    overflow: 'hidden',
  },
  islandOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  mapIslandOverlay: {
    backgroundColor: 'rgba(53, 31, 59, 1))',
  },
  islandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    paddingBottom: 32
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    gap: 8,
  },
  centerGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    marginHorizontal: 8,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(177, 57, 137, 0.12)',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 130,
    backgroundColor: 'rgba(53, 31, 59, 1))',
    borderWidth: 0,
    color: "#ffffff",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  primarySearchButton: {
    backgroundColor: '#ffffffff',
    borderColor: '#ffffffff',
    shadowColor: '#52134cff',
    shadowOpacity: 0.3,
  },
  searchButtonActive: {
    backgroundColor: '#52134cff',
  },
  searchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchButtonTextPrimary: {
    color: '#fff',
  },
  searchButtonTextSecondary: {
    color: '#ffffffff',
  },
});
