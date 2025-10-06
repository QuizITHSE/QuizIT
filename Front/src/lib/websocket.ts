import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  message?: string;
  code?: string;
  data?: any;
  [key: string]: any; // Для дополнительных полей
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Уменьшаем количество попыток
  private reconnectInterval = 5000; // Увеличиваем интервал
  private listeners: Map<string, (data: any) => void> = new Map();
  private isConnecting = false; // Флаг для предотвращения множественных подключений

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Предотвращаем множественные подключения
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
        console.log('⚠️ WebSocket уже подключается, пропускаем повторное подключение');
        resolve();
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('✅ WebSocket уже подключен');
        resolve();
        return;
      }

      this.isConnecting = true;
      console.log('🔌 Начинаем подключение к WebSocket:', url);
      
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('✅ WebSocket подключен');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📥 ПОЛУЧЕНО WebSocket сообщение:', {
              type: message.type,
              timestamp: new Date().toISOString(),
              rawData: event.data,
              parsedMessage: message
            });
            
            // Вызываем обработчики для конкретных типов сообщений
            const handler = this.listeners.get(message.type);
            if (handler) {
              console.log(`🎯 Вызываем обработчик для типа "${message.type}"`);
              // Передаем все сообщение, а не только data
              handler(message);
            } else {
              console.log(`⚠️ Нет обработчика для типа "${message.type}"`);
            }
          } catch (error) {
            console.error('❌ Ошибка при парсинге сообщения:', error, 'Raw data:', event.data);
          }
        };

        this.ws.onclose = (event) => {
          console.log('❌ WebSocket отключен:', event.code, event.reason);
          this.isConnecting = false;
          this.attemptReconnect(url);
        };

        this.ws.onerror = (error) => {
          console.error('❌ Ошибка WebSocket:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${this.reconnectInterval}ms`);
      
      setTimeout(() => {
        if (!this.isConnecting && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.connect(url).catch(console.error);
        }
      }, this.reconnectInterval);
    } else {
      console.error('❌ Превышено максимальное количество попыток переподключения');
    }
  }

  send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = { type, data };
      console.log('📤 ОТПРАВКА WebSocket сообщения:', {
        type: message.type,
        data: message.data,
        timestamp: new Date().toISOString(),
        fullMessage: message
      });
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket не подключен, не могу отправить сообщение:', { type, data });
    }
  }

  onMessage(type: string, handler: (data: any) => void) {
    this.listeners.set(type, handler);
  }

  disconnect() {
    console.log('🔌 Принудительное отключение WebSocket');
    this.isConnecting = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Предотвращаем переподключение
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Создаем глобальный экземпляр
export const wsManager = new WebSocketManager();

// Хук для использования WebSocket в компонентах
export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        await wsManager.connect(url);
        setIsConnected(true);
        setError(null);
        wsRef.current = wsManager;
      } catch (err) {
        setError('Ошибка подключения к WebSocket');
        setIsConnected(false);
        console.error('Ошибка подключения:', err);
      }
    };

    connect();

    return () => {
      wsManager.disconnect();
      setIsConnected(false);
    };
  }, [url]);

  const sendMessage = (type: string, data: any) => {
    if (wsRef.current) {
      wsRef.current.send(type, data);
    }
  };

  const onMessage = (type: string, handler: (data: any) => void) => {
    if (wsRef.current) {
      wsRef.current.onMessage(type, handler);
    }
  };

  return {
    isConnected,
    error,
    sendMessage,
    onMessage,
    disconnect: () => wsManager.disconnect()
  };
};

export default WebSocketManager;
