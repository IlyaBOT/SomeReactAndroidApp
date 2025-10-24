import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { View, Alert, ActivityIndicator, Modal, Text, TextInput, Button, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MapCoordinates {
  latitude: number;
  longitude: number;
}

interface MapMessage {
  type: 'MAP_CLICK' | 'SEARCH_RESULT' | 'MAP_LOADED' | 'ROUTE_BUILT' | 'ERROR' | 'MAP_LONG_PRESS';
  latitude?: number;
  longitude?: number;
  address?: string;
  error?: string;
}

interface YandexMapProps {
  apiKey: string;
  initialLocation?: MapCoordinates;
  onLocationSelect?: (coords: MapCoordinates, address?: string) => void;
}

export type YandexMapHandle = {
  searchAddress: (address: string) => void;
  moveToCoordinates: (coords: MapCoordinates) => void;
  buildRoute: (address: string, start?: MapCoordinates) => void;
  getSelectedLocation: () => MapCoordinates;
  getSelectedAddress: () => string | undefined;
};

const YandexMap = forwardRef<YandexMapHandle, YandexMapProps>(({
  apiKey,
  initialLocation = { latitude: 55.7558, longitude: 37.6173 },
  onLocationSelect
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const [selectedLocation, setSelectedLocation] = useState<MapCoordinates>(initialLocation);
  const [address, setAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [markers, setMarkers] = useState<any[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newPlaceCoords, setNewPlaceCoords] = useState<MapCoordinates | null>(null);
  const [newPlaceName, setNewPlaceName] = useState<string>('');
  const [newPlaceDesc, setNewPlaceDesc] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);

  // Load token and user role on mount
  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('token');
        if (t) {
          setToken(t);
          const res = await fetch('http://192.168.1.101:8443/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${t}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUserRole(data.role);
          }
        }
      } catch (error) {
        console.warn('Ошибка при получении роли пользователя', error);
      }
    })();
  }, []);

  // Fetch places (markers) on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://192.168.1.101/places');
        if (res.ok) {
          const data = await res.json();
          setMarkers(data);
        } else {
          console.warn('Не удалось загрузить места:', res.status);
        }
      } catch (error) {
        console.warn('Ошибка при загрузке мест:', error);
      }
    })();
  }, []);

  // When map is loaded or markers change, add markers on map
  useEffect(() => {
    if (isMapLoaded) {
      markers.forEach(marker => {
        const { lat, lon, name, description } = marker;
        const js = `
          window.addMarker(${lat}, ${lon}, "${name.replace(/"/g, '\\"')}", "${description.replace(/"/g, '\\"')}");
          true;
        `;
        webViewRef.current?.injectJavaScript(js);
      });
    }
  }, [isMapLoaded, markers]);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data: MapMessage = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'MAP_LOADED':
          setIsLoading(false);
          setIsMapLoaded(true);
          break;
        case 'MAP_CLICK':
          if (data.latitude && data.longitude) {
            const newCoords: MapCoordinates = {
              latitude: data.latitude,
              longitude: data.longitude
            };
            setSelectedLocation(newCoords);
            setAddress(data.address || '');
            onLocationSelect?.(newCoords, data.address);
          }
          break;
        case 'SEARCH_RESULT':
          if (data.latitude && data.longitude) {
            const newCoords: MapCoordinates = {
              latitude: data.latitude,
              longitude: data.longitude
            };
            setSelectedLocation(newCoords);
            setAddress(data.address || '');
            onLocationSelect?.(newCoords, data.address);
          }
          break;
        case 'ROUTE_BUILT':
          if (data.latitude && data.longitude) {
            const routeCoords: MapCoordinates = {
              latitude: data.latitude,
              longitude: data.longitude
            };
            setSelectedLocation(routeCoords);
            setAddress(data.address || '');
            onLocationSelect?.(routeCoords, data.address);
          }
          break;
        case 'MAP_LONG_PRESS':
          if (data.latitude && data.longitude) {
            const coords: MapCoordinates = {
              latitude: data.latitude,
              longitude: data.longitude
            };
            // Only business owners can add
            if (userRole === 'businessOwner') {
              setNewPlaceCoords(coords);
              setShowAddModal(true);
            } else {
              Alert.alert('Ошибка', 'Только бизнес-пользователь может добавлять маркеры');
            }
          }
          break;
        case 'ERROR':
          Alert.alert('Ошибка', data.error || 'Произошла ошибка');
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const searchAddress = (query: string) => {
    if (!query.trim()) return;
    const sanitized = query.trim().replace(/"/g, '\\"');
    webViewRef.current?.injectJavaScript(`
      window.searchAddress("${sanitized}");
      true;
    `);
  };

  const moveToCoordinates = (coords: MapCoordinates) => {
    webViewRef.current?.injectJavaScript(`
      window.moveToCoordinates(${coords.latitude}, ${coords.longitude});
      true;
    `);
  };

  const buildRoute = (destination: string, start?: MapCoordinates) => {
    const trimmed = destination.trim();
    if (!trimmed) return;
    const sanitized = trimmed.replace(/"/g, '\\"');
    const startLat = start ? start.latitude : 'null';
    const startLon = start ? start.longitude : 'null';
    webViewRef.current?.injectJavaScript(`
      window.buildRoute("${sanitized}", ${startLat}, ${startLon});
      true;
    `);
  };

  // Handle add marker form submission
  const handleAddMarker = async () => {
    if (!newPlaceCoords) return;
    try {
      const res = await fetch('http://192.168.1.101/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: newPlaceName,
          desc: newPlaceDesc,
          lat: newPlaceCoords.latitude,
          lon: newPlaceCoords.longitude
        })
      });
      if (res.ok) {
        const created = await res.json();
        // Update local markers state
        setMarkers([...markers, created]);
        // Reset form
        setShowAddModal(false);
        setNewPlaceCoords(null);
        setNewPlaceName('');
        setNewPlaceDesc('');
      } else {
        Alert.alert('Ошибка', `Не удалось добавить маркер (${res.status})`);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Ошибка при добавлении маркера');
      console.error(error);
    }
  };

  useImperativeHandle(ref, () => ({
    searchAddress,
    moveToCoordinates,
    buildRoute,
    getSelectedLocation: () => selectedLocation,
    getSelectedAddress: () => address,
  }), [address, selectedLocation]);

  const getMapHTML = (): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU"></script>
    <style>
        body, html, #map { 
            width: 100%; 
            height: 100%; 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif;
        }
        .balloon {
            padding: 10px;
            max-width: 200px;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        let map;
        let currentMarker;
        let currentRoute;
        let pressTimer;

        ymaps.ready(init);

        function init() {
            // Отправляем сообщение о загрузке карты
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MAP_LOADED'
            }));

            map = new ymaps.Map('map', {
                center: [${initialLocation.latitude}, ${initialLocation.longitude}],
                zoom: 12,
                controls: ['zoomControl', 'fullscreenControl']
            });

            // Добавляем начальный маркер
            currentMarker = new ymaps.Placemark([${initialLocation.latitude}, ${initialLocation.longitude}], {
                balloonContent: 'Начальная позиция'
            }, {
                preset: 'islands#blueDotIcon'
            });

            map.geoObjects.add(currentMarker);

            // Обработчик клика по карте
            map.events.add('click', function (e) {
                const coords = e.get('coords');
                
                // Обновляем маркер
                map.geoObjects.remove(currentMarker);
                currentMarker = new ymaps.Placemark(coords, {
                    balloonContent: 'Выбранная точка<br/>Координаты: ' + coords.join(', ')
                }, {
                    preset: 'islands#redIcon'
                });
                
                map.geoObjects.add(currentMarker);

                // Получаем адрес по координатам
                ymaps.geocode(coords).then(function (res) {
                    const firstGeoObject = res.geoObjects.get(0);
                    const address = firstGeoObject.getAddressLine();
                    
                    // Отправляем данные в React Native
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'MAP_CLICK',
                        latitude: coords[0],
                        longitude: coords[1],
                        address: address
                    }));
                });
            });

            // Long press handler for adding marker
            map.events.add('mousedown', function (e) {
                pressTimer = setTimeout(function () {
                    const coords = e.get('coords');
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'MAP_LONG_PRESS',
                        latitude: coords[0],
                        longitude: coords[1]
                    }));
                }, 600);
            });
            map.events.add('mouseup', function (e) {
                clearTimeout(pressTimer);
            });
        }

        // Function to add marker with title and description
        window.addMarker = function(lat, lon, title, desc) {
            const placemark = new ymaps.Placemark([lat, lon], {
                balloonContent: '<div class="balloon"><h3>' + title + '</h3><p>' + desc + '</p></div>'
            }, {
                preset: 'islands#violetIcon'
            });
            map.geoObjects.add(placemark);
        };

        // Function for searching address
        window.searchAddress = function(address) {
            if (!address) return;
            
            ymaps.geocode(address).then(function (res) {
                const firstGeoObject = res.geoObjects.get(0);
                if (!firstGeoObject) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'ERROR',
                        error: 'Адрес не найден'
                    }));
                    return;
                }
                
                const coords = firstGeoObject.geometry.getCoordinates();
                const foundAddress = firstGeoObject.getAddressLine();
                
                // Обновляем карту
                map.setCenter(coords, 15);
                map.geoObjects.remove(currentMarker);
                if (currentRoute) {
                    map.geoObjects.remove(currentRoute);
                    currentRoute = null;
                }
                
                currentMarker = new ymaps.Placemark(coords, {
                    balloonContent: foundAddress
                }, {
                    preset: 'islands#greenIcon'
                });
                
                map.geoObjects.add(currentMarker);

                // Отправляем результат
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SEARCH_RESULT',
                    latitude: coords[0],
                    longitude: coords[1],
                    address: foundAddress
                }));
            }).catch(function (error) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ERROR',
                    error: 'Ошибка поиска: ' + error
                }));
            });
        };

        // Function to move map to coordinates
        window.moveToCoordinates = function(lat, lon) {
            const coords = [lat, lon];
            map.setCenter(coords, 15);
            
            map.geoObjects.remove(currentMarker);
            currentMarker = new ymaps.Placemark(coords, {
                balloonContent: 'Новая позиция<br/>Координаты: ' + coords.join(', ')
            }, {
                preset: 'islands#blueIcon'
            });
            
            map.geoObjects.add(currentMarker);
        };

        // Function to build route
        window.buildRoute = function(address, startLat, startLon) {
            if (!address) return;

            ymaps.geocode(address).then(function (res) {
                const geoObject = res.geoObjects.get(0);
                if (!geoObject) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'ERROR',
                        error: 'Маршрут не найден'
                    }));
                    return;
                }

                const destinationCoords = geoObject.geometry.getCoordinates();
                const destinationAddress = geoObject.getAddressLine();

                const hasProvidedStart = typeof startLat === 'number' && !Number.isNaN(startLat) && typeof startLon === 'number' && !Number.isNaN(startLon);

                const startPromise = hasProvidedStart
                    ? Promise.resolve([startLat, startLon])
                    : ymaps.geolocation.get({ provider: 'auto', mapStateAutoApply: false })
                        .then(function (result) {
                            const pos = result.geoObjects.position;
                            if (Array.isArray(pos) && pos.length === 2 && typeof pos[0] === 'number' && typeof pos[1] === 'number') {
                                return pos;
                            }
                            return map.getCenter();
                        })
                        .catch(function () {
                            return map.getCenter();
                        });

                startPromise.then(function (startCoords) {
                    ymaps.route([startCoords, destinationCoords], { mapStateAutoApply: true })
                        .then(function(route) {
                            if (currentRoute) {
                                map.geoObjects.remove(currentRoute);
                            }
                            currentRoute = route;
                            map.geoObjects.add(route);

                            if (route && typeof route.getBounds === 'function') {
                                const bounds = route.getBounds();
                                if (bounds) {
                                    map.setBounds(bounds, { checkZoomRange: true, duration: 300 });
                                }
                            }

                            map.geoObjects.remove(currentMarker);
                            currentMarker = new ymaps.Placemark(destinationCoords, {
                                balloonContent: destinationAddress
                            }, {
                                preset: 'islands#redDotIcon'
                            });
                            map.geoObjects.add(currentMarker);

                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'ROUTE_BUILT',
                                latitude: destinationCoords[0],
                                longitude: destinationCoords[1],
                                address: destinationAddress
                            }));
                        })
                        .catch(function (error) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'ERROR',
                                error: 'Не удалось построить маршрут: ' + error
                            }));
                        });
                });
            });
        };
    </script>
</body>
</html>
`;  // end of getMapHTML

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6e0aa4" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: getMapHTML() }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
      />

      {/* Modal for adding new marker */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Добавить место</Text>
            <TextInput
              style={styles.input}
              placeholder="Название"
              value={newPlaceName}
              onChangeText={setNewPlaceName}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Описание"
              value={newPlaceDesc}
              onChangeText={setNewPlaceDesc}
              multiline
            />
            <View style={styles.modalButtons}>
              <Button title="Отменить" onPress={() => { setShowAddModal(false); setNewPlaceCoords(null); }} />
              <Button title="Добавить" onPress={handleAddMarker} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

YandexMap.displayName = 'YandexMap';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default YandexMap;