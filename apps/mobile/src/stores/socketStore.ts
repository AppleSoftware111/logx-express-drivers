import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';

import { API_URL } from '../services/api';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  lastError: string | null;
  lastToken: string | null;
  setConnected: (connected: boolean) => void;
  connect: (token: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  lastError: null,
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
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10_000,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      set({ connected: true, lastError: null });
    });

    newSocket.on('disconnect', () => {
      set({ connected: false });
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[mobile-socket] connect_error', err.message, API_URL);
      set({ lastError: err.message, connected: false });
    });

    set({ socket: newSocket, lastToken: token, connected: false, lastError: null });
  },
  disconnect: () => {
    const { socket } = get();
    socket?.removeAllListeners();
    socket?.disconnect();
    set({ socket: null, connected: false, lastToken: null, lastError: null });
  },
}));
