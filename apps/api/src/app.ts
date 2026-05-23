import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import alertRoutes from './modules/alerts/alert.routes';
import authRoutes from './modules/auth/auth.routes';
import branchRoutes from './modules/branches/branch.routes';
import clientRoutes from './modules/clients/client.routes';
import companyRoutes from './modules/companies/company.routes';
import contractRoutes from './modules/contracts/contract.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import driverRoutes from './modules/drivers/driver.routes';
import executionRoutes from './modules/executions/execution.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import podRoutes from './modules/pod/pod.routes';
import reportsRoutes from './modules/reports/reports.routes';
import routeRoutes from './modules/routes/route.routes';
import trackingRoutes from './modules/tracking/tracking.routes';
import vehicleRoutes from './modules/vehicles/vehicle.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(generalLimiter);

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/branches', branchRoutes);
  app.use('/api/drivers', driverRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/contracts', contractRoutes);
  app.use('/api/routes', routeRoutes);
  app.use('/api/executions', executionRoutes);
  app.use('/api/tracking', trackingRoutes);
  app.use('/api/pod', podRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(errorHandler);

  return app;
}
