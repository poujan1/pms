import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';

const server = app.listen(env.PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`🌾 Paddy Management System (PMS) Backend running on port ${env.PORT}`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
    console.log(`🔌 Database connected successfully`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('HTTP server and database connections closed');
  });
});
