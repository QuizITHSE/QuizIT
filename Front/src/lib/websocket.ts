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
        resolve();
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;
      
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Вызываем обработчики для конкретных типов сообщений
            const handler = this.listeners.get(message.type);
            if (handler) {
              // Передаем все сообщение, а не только data
              handler(message);
            } else {
            }
          } catch (error) {
          }
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.attemptReconnect(url);
        };

        this.ws.onerror = (error) => {
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
      
      setTimeout(() => {
        if (!this.isConnecting && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
        }
      }, this.reconnectInterval);
    } else {
    }
  }

  send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = { type, data };
      this.ws.send(JSON.stringify(message));
    } else {
    }
  }

  onMessage(type: string, handler: (data: any) => void) {
    this.listeners.set(type, handler);
  }

  disconnect() {
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
