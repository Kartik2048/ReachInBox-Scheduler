import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import authRouter from './routes/auth.routes';
import senderRouter from './routes/sender.routes';
import emailRouter from './routes/email.routes';

export const app = express();


// Middleware: Request logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Middleware: CORS for local dev and free-tier PaaS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin === env.FRONTEND_URL ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Middleware: Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Keep-Alive Health Endpoint for UptimeRobot / PaaS Healthchecks
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root ping
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'ReachInbox Email Job Scheduler API',
    status: 'healthy',
    documentation: '/api/health',
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/senders', senderRouter);
app.use('/api/emails', emailRouter);


// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

export default app;
