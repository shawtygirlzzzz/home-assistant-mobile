import AsyncStorage from '@react-native-async-storage/async-storage';

export class HomeAssistantAPI {
  private static instance: HomeAssistantAPI;
  private serverUrl: string | null = null;
  private token: string | null = null;

  private constructor() {}

  static getInstance(): HomeAssistantAPI {
    if (!HomeAssistantAPI.instance) {
      HomeAssistantAPI.instance = new HomeAssistantAPI();
    }
    return HomeAssistantAPI.instance;
  }

  async initialize() {
    this.serverUrl = await AsyncStorage.getItem('serverUrl');
    this.token = await AsyncStorage.getItem('token');
    return this.isInitialized();
  }

  isInitialized(): boolean {
    return !!(this.serverUrl && this.token);
  }

  async validateToken(serverUrl: string, token: string) {
    try {
      const response = await fetch(`${serverUrl}/api/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async saveCredentials(serverUrl: string, token: string) {
    await AsyncStorage.setItem('serverUrl', serverUrl);
    await AsyncStorage.setItem('token', token);
    this.serverUrl = serverUrl;
    this.token = token;
  }

  async clearCredentials() {
    await AsyncStorage.removeItem('serverUrl');
    await AsyncStorage.removeItem('token');
    this.serverUrl = null;
    this.token = null;
  }
}