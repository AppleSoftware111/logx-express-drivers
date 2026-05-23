import type { Server, Socket } from 'socket.io';

export function registerDashboardHandlers(_io: Server, socket: Socket): void {
  const { role } = socket.data as { role: string };

  if (!['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(role)) return;

  socket.on('admin:subscribe_execution', (executionId: string) => {
    void socket.join(`execution:${executionId}`);
  });

  socket.on('admin:unsubscribe_execution', (executionId: string) => {
    void socket.leave(`execution:${executionId}`);
  });
}
