import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeAssistantAPI } from '../services/HomeAssistantAPI';
import { useHomeAssistant } from '../contexts/HomeAssistantContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  Main: undefined;
};

type AuthScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Auth'>;

interface AuthScreenProps {
  navigation: AuthScreenNavigationProp;
}

export default function AuthScreen({ navigation }: AuthScreenProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useHomeAssistant();

  const handleConnect = async () => {
    if (!serverUrl || !token) {
      alert('Please enter both server URL and access token');
      return;
    }

    setIsLoading(true);
    try {
      const formattedUrl = serverUrl.endsWith('/')
        ? serverUrl.slice(0, -1)
        : serverUrl;

      const success = await login(formattedUrl, token);
      
      if (success) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      alert('Connection failed. Please check your server URL and token.');
      console.error('Connection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Connect to Home Assistant</Text>
        <Text style={styles.subtitle}>Enter your Home Assistant details</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Server URL (e.g., http://homeassistant.local:8123)"
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isLoading}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Long-Lived Access Token"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          editable={!isLoading}
        />
        
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          To get your long-lived access token:{'\n'}
          1. Open Home Assistant{'\n'}
          2. Click your profile name{'\n'}
          3. Scroll to Long-Lived Access Tokens{'\n'}
          4. Create a new token
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  helpText: {
    marginTop: 30,
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  }
});
