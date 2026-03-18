import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { HomeAssistantAPI } from './src/services/HomeAssistantAPI';
import AppNavigator from './src/navigation/AppNavigator';
import { HomeAssistantProvider } from './src/contexts/HomeAssistantContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Clear any existing credentials to ensure fresh start
      await AsyncStorage.removeItem('serverUrl');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('accessToken'); // Clear old token format too
      
      const api = HomeAssistantAPI.getInstance();
      await api.clearCredentials(); // Clear API instance state
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error during auth check:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <HomeAssistantProvider>
      <AppNavigator isAuthenticated={isAuthenticated} />
    </HomeAssistantProvider>
  );
}
