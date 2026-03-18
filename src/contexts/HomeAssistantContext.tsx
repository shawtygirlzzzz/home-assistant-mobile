import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

interface HomeAssistantContextType {
  isAuthenticated: boolean;
  serverUrl: string;
  accessToken: string;
  entities: Record<string, EntityState>;
  setServerUrl: (url: string) => void;
  setAccessToken: (token: string) => void;
  login: (url: string, token: string) => Promise<boolean>;
  logout: () => void;
  getEntityState: (entityId: string) => EntityState | null;
  callService: (domain: string, service: string, entityId: string, serviceData?: Record<string, any>) => Promise<void>;
}

const HomeAssistantContext = createContext<HomeAssistantContextType | undefined>(undefined);

export const useHomeAssistant = () => {
  const context = useContext(HomeAssistantContext);
  if (!context) {
    throw new Error('useHomeAssistant must be used within a HomeAssistantProvider');
  }
  return context;
};

export const HomeAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [entities, setEntities] = useState<Record<string, EntityState>>({});
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Start with a clean slate
    setIsAuthenticated(false);
    setServerUrl('');
    setAccessToken('');
    setEntities({});
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && serverUrl && accessToken) {
      setupWebSocket();
      fetchInitialStates();
    }
  }, [isAuthenticated, serverUrl, accessToken]);

  const setupWebSocket = () => {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/api/websocket';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        access_token: accessToken,
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'event' && message.event.event_type === 'state_changed') {
        const { entity_id, new_state } = message.event.data;
        setEntities(prev => ({
          ...prev,
          [entity_id]: new_state,
        }));
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      // Attempt to reconnect after a delay
      setTimeout(setupWebSocket, 5000);
    };

    setWsConnection(ws);
  };

  const fetchInitialStates = async () => {
    try {
      const response = await axios.get(`${serverUrl}/api/states`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const statesMap: Record<string, EntityState> = {};
      response.data.forEach((state: EntityState) => {
        statesMap[state.entity_id] = state;
      });
      setEntities(statesMap);
    } catch (error) {
      console.error('Error fetching states:', error);
    }
  };

  const loadStoredCredentials = async () => {
    try {
      const storedUrl = await AsyncStorage.getItem('serverUrl');
      const storedToken = await AsyncStorage.getItem('token');
      
      if (storedUrl && storedToken) {
        setServerUrl(storedUrl);
        setAccessToken(storedToken);
        const isValid = await validateCredentials(storedUrl, storedToken);
        setIsAuthenticated(isValid);
      }
    } catch (error) {
      console.error('Error loading stored credentials:', error);
    }
  };

  const validateCredentials = async (url: string, token: string) => {
    try {
      const response = await axios.get(`${url}/api/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.status === 200;
    } catch (error) {
      console.error('Error validating credentials:', error);
      return false;
    }
  };

  const login = async (url: string, token: string) => {
    try {
      const isValid = await validateCredentials(url, token);
      if (isValid) {
        await AsyncStorage.setItem('serverUrl', url);
        await AsyncStorage.setItem('token', token);
        setServerUrl(url);
        setAccessToken(token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (wsConnection) {
        wsConnection.close();
      }
      await AsyncStorage.removeItem('serverUrl');
      await AsyncStorage.removeItem('token');
      setServerUrl('');
      setAccessToken('');
      setIsAuthenticated(false);
      setEntities({});
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const getEntityState = (entityId: string): EntityState | null => {
    return entities[entityId] || null;
  };

  const callService = async (domain: string, service: string, entityId: string, serviceData: Record<string, any> = {}) => {
    try {
      await axios.post(
        `${serverUrl}/api/services/${domain}/${service}`,
        {
          entity_id: entityId,
          ...serviceData,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error calling service:', error);
      throw error;
    }
  };

  return (
    <HomeAssistantContext.Provider
      value={{
        isAuthenticated,
        serverUrl,
        accessToken,
        entities,
        setServerUrl,
        setAccessToken,
        login,
        logout,
        getEntityState,
        callService,
      }}
    >
      {children}
    </HomeAssistantContext.Provider>
  );
};
