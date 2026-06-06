import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';

import { API_URL } from '../services/api';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  lastToken: string | null;
  setConnected: (connected: boolean) => void;
  connect: (token: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  lastToken: null,
  setConnected: (connected) => set({ connected }),
  connect: (token) => {
    const { socket, lastToken } = get();

    if (lastToken === token && socket && (socket.connected || socket.active)) {
      return;
    }

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      set({ connected: true });
    });

    newSocket.on('disconnect', () => {
      set({ connected: false });
    });

    newSocket.on('connect_error', (err) => {
      if (__DEV__) {
        console.warn('[mobile-socket]', err.message);
      }
    });

    set({ socket: newSocket, lastToken: token, connected: false });
  },
  disconnect: () => {
    const { socket } = get();
    socket?.removeAllListeners();
    socket?.disconnect();
    set({ socket: null, connected: false, lastToken: null });
  },
}));
