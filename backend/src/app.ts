import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ApolloServer } from 'apollo-server-express';
import dotenv from 'dotenv';

import patientRoutes from './routes/patientRoutes';
import authRoutes from './routes/authRoutes';
import vitalSignRoutes from './routes/vitalSignRoutes';

import { typeDefs, resolvers } from './graphql/schema';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { RedisService } from './services/RedisService';
import { SocketService } from './services/SocketService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// 기본 미들웨어들
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// 헬스체크 - 모니터링용
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/patients', authMiddleware, patientRoutes);
app.use('/api/vital-signs', authMiddleware, vitalSignRoutes);

// 서비스 초기화
async function initializeServices() {
  try {
    // Redis 연결
    await RedisService.initialize();
    logger.info('Redis connected');

    // Socket.IO 초기화
    const socketService = new SocketService(io);
    socketService.initialize();
    logger.info('Socket.IO initialized');

    // GraphQL 서버 설정
    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => ({
        user: req.user,
        redis: RedisService.client
      })
    });

    await apolloServer.start();
    apolloServer.applyMiddleware({ app, path: '/graphql' });
    logger.info('GraphQL ready at /graphql');

  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// 에러 핸들링
app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

httpServer.listen(PORT, async () => {
  await initializeServices();
  logger.info(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  httpServer.close(() => {
    RedisService.disconnect();
    process.exit(0);
  });
});

export default app;