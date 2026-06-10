import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10_000,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      set({ connected: true });
    });

    newSocket.on('disconnect', () => {
      set({ connected: false });
    });

    newSocket.on('connect_error', (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[socket]', err.message);
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
