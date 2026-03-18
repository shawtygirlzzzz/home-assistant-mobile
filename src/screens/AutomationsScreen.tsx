import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';

interface Entity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name: string;
    [key: string]: any;
  };
}

const AutomationsScreen = () => {
  const navigation = useNavigation();
  const { serverUrl, accessToken } = useHomeAssistant();
  const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllEntities();
    loadSelectedEntities();
  }, []);

  const fetchAllEntities = async () => {
    try {
      const response = await axios.get(`${serverUrl}/api/states`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Filter out entities that are already in the dashboard (guest lights)
      const filteredEntities = response.data.filter(
        (entity: Entity) =>
          entity.entity_id !== 'switch.guest_light_1' &&
          entity.entity_id !== 'switch.guest_light_2' &&
          (entity.entity_id.startsWith('switch.') || 
           entity.entity_id.startsWith('light.'))
      );

      setAvailableEntities(filteredEntities);
    } catch (error) {
      console.error('Error fetching entities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSelectedEntities = async () => {
    try {
      const saved = await AsyncStorage.getItem('selectedEntities');
      if (saved) {
        setSelectedEntities(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading selected entities:', error);
    }
  };

  const toggleEntitySelection = async (entityId: string) => {
    try {
      const newSelectedEntities = selectedEntities.includes(entityId)
        ? selectedEntities.filter(id => id !== entityId)
        : [...selectedEntities, entityId];
      
      setSelectedEntities(newSelectedEntities);
      await AsyncStorage.setItem('selectedEntities', JSON.stringify(newSelectedEntities));

      // Navigate back to dashboard after a short delay to show the selection change
      setTimeout(() => {
        navigation.goBack();
      }, 300);
    } catch (error) {
      console.error('Error saving selected entities:', error);
    }
  };

  const renderEntity = ({ item }: { item: Entity }) => {
    const isSelected = selectedEntities.includes(item.entity_id);
    
    return (
      <TouchableOpacity
        style={[
          styles.entityCard,
          isSelected && styles.selectedCard
        ]}
        onPress={() => toggleEntitySelection(item.entity_id)}
      >
        <View style={styles.entityInfo}>
          <Text style={styles.entityName}>
            {item.attributes.friendly_name || item.entity_id}
          </Text>
          <Text style={styles.entityId}>{item.entity_id}</Text>
        </View>
        <View style={[styles.checkCircle, isSelected && styles.selectedCheckCircle]}>
          <Ionicons
            name={isSelected ? 'checkmark' : 'add'}
            size={20}
            color={isSelected ? '#fff' : '#007AFF'}
          />
        </View>
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
          <Text style={styles.title}>Add Devices</Text>
          <Text style={styles.subtitle}>
            Select devices to add to your dashboard
          </Text>
        </View>
        <FlatList
          data={availableEntities}
          renderItem={renderEntity}
          keyExtractor={item => item.entity_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
};

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
    padding: 20,
    paddingBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  entityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedCard: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  entityInfo: {
    flex: 1,
    marginRight: 16,
  },
  entityName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  entityId: {
    fontSize: 14,
    color: '#666',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  selectedCheckCircle: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
});

export default AutomationsScreen; 