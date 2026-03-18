import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  Main: undefined;
  Automations: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Entity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name: string;
    [key: string]: any;
  };
}

const DashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  
  // Add navigation options to hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const { serverUrl, accessToken } = useHomeAssistant();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchEntities();
    }, [])
  );

  const fetchEntities = async () => {
    try {
      const response = await axios.get(`${serverUrl}/api/states`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Get selected entities from storage
      const savedEntities = await AsyncStorage.getItem('selectedEntities');
      const selectedEntityIds = savedEntities ? JSON.parse(savedEntities) : [];

      // Filter guest lights and selected entities
      const allEntities = response.data.filter((entity: Entity) => 
        entity.entity_id === 'switch.guest_light_1' || 
        entity.entity_id === 'switch.guest_light_2' ||
        selectedEntityIds.includes(entity.entity_id)
      );

      setEntities(allEntities);
    } catch (error) {
      console.error('Error fetching entities:', error);
      alert('Failed to fetch Home Assistant entities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDevice = async (entityId: string) => {
    try {
      // Update local state optimistically
      setEntities(currentEntities => 
        currentEntities.map(entity => {
          if (entity.entity_id === entityId) {
            return {
              ...entity,
              state: entity.state === 'on' ? 'off' : 'on'
            };
          }
          return entity;
        })
      );

      // Determine the domain from the entity_id
      const domain = entityId.split('.')[0];
      
      // Send toggle command
      await axios.post(
        `${serverUrl}/api/services/${domain}/toggle`,
        { entity_id: entityId },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Function to get entity state with retries
      const getEntityState = async (retryCount = 0, maxRetries = 3) => {
        const stateResponse = await axios.get(
          `${serverUrl}/api/states/${entityId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const expectedState = entities.find(e => e.entity_id === entityId)?.state === 'on' ? 'off' : 'on';
        
        if (stateResponse.data.state !== expectedState && retryCount < maxRetries) {
          // Wait for 300ms before next retry
          await new Promise(resolve => setTimeout(resolve, 300));
          return getEntityState(retryCount + 1, maxRetries);
        }

        return stateResponse.data;
      };

      // Wait for 200ms to allow Home Assistant to update its state
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get the actual state after toggle with retries
      const updatedState = await getEntityState();

      // Update with actual state from server
      setEntities(currentEntities =>
        currentEntities.map(entity => {
          if (entity.entity_id === entityId) {
            return updatedState;
          }
          return entity;
        })
      );

    } catch (error) {
      console.error('Error toggling device:', error);
      alert('Failed to toggle device');
      // Revert optimistic update on error
      await fetchEntities();
    }
  };

  const handleLogout = async () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      })
    );
  };

  const renderDevice = (entity: Entity) => {
    const isLight = entity.entity_id.startsWith('light.');
    const isGuestLight = entity.entity_id === 'switch.guest_light_1' || 
                        entity.entity_id === 'switch.guest_light_2';

    return (
      <TouchableOpacity
        key={entity.entity_id}
        style={[
          styles.deviceCard,
          { backgroundColor: entity.state === 'on' ? '#007AFF' : '#fff' },
        ]}
        onPress={() => handleToggleDevice(entity.entity_id)}
      >
        <Ionicons
          name={isLight ? 'bulb' : 'power'}
          size={24}
          color={entity.state === 'on' ? '#fff' : '#1a1a1a'}
        />
        <Text
          style={[
            styles.deviceName,
            { color: entity.state === 'on' ? '#fff' : '#1a1a1a' },
          ]}
        >
          {entity.attributes.friendly_name || entity.entity_id}
        </Text>
        <Text
          style={[
            styles.deviceStatus,
            { color: entity.state === 'on' ? '#fff' : '#666' },
          ]}
        >
          {entity.state.charAt(0).toUpperCase() + entity.state.slice(1)}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome Home</Text>
            <Text style={styles.title}>Smart Controls</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('Automations')}>
            <Ionicons name="add-circle" size={32} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {entities.map(renderDevice)}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  grid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  deviceCard: {
    width: cardWidth,
    height: cardWidth,
    padding: 20,
    marginBottom: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: '#fff',
  },
  deviceName: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deviceStatus: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.7,
  },
});

export default DashboardScreen;
