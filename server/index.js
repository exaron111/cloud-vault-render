import express from 'express';
import { registerRoutes } from './routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Логгинг
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

const PORT = process.env.PORT || 10000;

registerRoutes(app.listen(PORT, () => {
  console.log(`✅ Cloud Vault работает на порту ${PORT}`);
}), app).catch(err => {
  console.error('Ошибка запуска:', err);
  process.exit(1);
});
