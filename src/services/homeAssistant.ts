import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HAConfig {
  baseUrl: string;
  accessToken: string;
}

export interface HAEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HAAutomation extends HAEntity {
  attributes: {
    id: string;
    name: string;
    last_triggered: string | null;
  };
}

type EventCallback = (data: any) => void;

class HomeAssistantAPI {
  private api: AxiosInstance;
  private websocket: WebSocket | null = null;
  private messageId = 1;
  private eventListeners: Map<string, EventCallback> = new Map();

  constructor(config: HAConfig) {
    this.api = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async validateAuth(): Promise<boolean> {
    try {
      const response = await this.api.get('/api/config');
      return response.status === 200;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async getStates(): Promise<HAEntity[]> {
    try {
      const response = await this.api.get<HAEntity[]>('/api/states');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch states:', error);
      throw error;
    }
  }

  async callService(domain: string, service: string, data: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await this.api.post(`/api/services/${domain}/${service}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to call service:', error);
      throw error;
    }
  }

  connectWebSocket(): void {
    if (!this.api.defaults.baseURL) {
      console.error('Base URL is not defined');
      return;
    }

    const wsUrl = this.api.defaults.baseURL.replace(/^http/, 'ws') + '/api/websocket';
    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      this.authenticate();
    };

    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleWebSocketMessage(message);
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.websocket.onclose = () => {
      console.log('WebSocket disconnected');
      // Implement reconnection logic here if needed
    };
  }

  private authenticate(): void {
    if (!this.websocket) return;
    
    const authToken = (this.api.defaults.headers['Authorization'] as string)?.replace('Bearer ', '') || '';
    
    const authMessage = {
      type: 'auth',
      access_token: authToken,
    };
    
    this.websocket.send(JSON.stringify(authMessage));
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'auth_required':
        this.authenticate();
        break;
      case 'auth_ok':
        this.subscribeToEvents();
        break;
      case 'event':
        if (message.event.event_type === 'state_changed') {
          const callback = this.eventListeners.get('state_changed');
          if (callback) {
            callback(message.event.data);
          }
        }
        break;
    }
  }

  private subscribeToEvents(): void {
    if (!this.websocket) return;
    
    const subscribeMessage = {
      id: this.messageId++,
      type: 'subscribe_events',
      event_type: 'state_changed',
    };
    
    this.websocket.send(JSON.stringify(subscribeMessage));
  }

  onStateChanged(callback: (data: HAEntity) => void): void {
    this.eventListeners.set('state_changed', callback);
  }

  async getAutomations(): Promise<HAAutomation[]> {
    try {
      const response = await this.api.get<HAEntity[]>('/api/states');
      return response.data.filter((entity: HAEntity): entity is HAAutomation => 
        entity.entity_id.startsWith('automation.')
      );
    } catch (error) {
      console.error('Failed to fetch automations:', error);
      throw error;
    }
  }

  async triggerAutomation(automationId: string): Promise<unknown> {
    try {
      return await this.callService('automation', 'trigger', {
        entity_id: automationId,
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
      throw error;
    }
  }
}

export default HomeAssistantAPI;
