import type { Server as HttpServer } from 'http';

import { Server as SocketIOServer } from 'socket.io';

import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwtHelpers';
import { registerDashboardHandlers } from './dashboardHandler';
import { registerGpsHandlers } from './gpsHandler';
import { SOCKET_ROOMS } from '@logx/shared';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!io) throw new Error('[socket] Socket.io not initialized');
  return io;
}

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(','),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ??
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyAccessToken(token as string);
    if (!payload) {
      return next(new Error('Invalid access token'));
    }

    socket.data.userId = payload.userId;
    socket.data.companyId = payload.companyId;
    socket.data.role = payload.role;
    socket.data.driverId = payload.driverId;
    socket.data.clientId = payload.clientId;

    next();
  });

  io.on('connection', (socket) => {
    const { companyId, role, driverId, clientId } = socket.data as {
      companyId: string;
      role: string;
      driverId?: string;
      clientId?: string;
    };

    // Join company room (all users)
    void socket.join(SOCKET_ROOMS.companyRoom(companyId));

    // Join role-specific rooms
    if (['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(role)) {
      void socket.join(SOCKET_ROOMS.adminRoom(companyId));
    }

    if (role === 'DRIVER' && driverId) {
      void socket.join(SOCKET_ROOMS.driverRoom(driverId));
    }

    if (role === 'CLIENT' && clientId) {
      void socket.join(SOCKET_ROOMS.clientRoom(clientId));
    }

    registerGpsHandlers(io!, socket);
    registerDashboardHandlers(io!, socket);

    socket.on('disconnect', () => {
      // Driver offline is handled in gpsHandler
    });
  });

  console.info('[socket] Socket.io initialized');
  return io;
}
