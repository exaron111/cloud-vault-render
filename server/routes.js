import multer from 'multer';
import { z } from 'zod';
import { db } from './db.js';
import { storage } from './storage.js';
import { users, files } from '../shared/schema.js';
import bcrypt from 'bcryptjs';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

async function requireAdmin(req, res, next) {
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, parseInt(userId)),
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can access this' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function registerRoutes(httpServer, app) {
  // Регистрация
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      
      const existing = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.username, username),
      });

      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [user] = await db.insert(users).values({
        username,
        password: hashedPassword,
        role: "user",
      }).returning();

      res.status(201).json({ 
        id: user.id, 
        username: user.username,
        role: user.role 
      });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Логин
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.username, username),
      });

      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      res.json({ 
        id: user.id, 
        username: user.username, 
        role: user.role 
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Статистика
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allFiles = await db.select().from(files);
      const allUsers = await db.select().from(users);
      
      const totalSize = allFiles.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
      
      res.json({
        totalFiles: allFiles.length,
        totalUsers: allUsers.length,
        totalSizeUsed: totalSize,
      });
    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Загрузка файла
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
      const uploadResult = await storage.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      const [fileRecord] = await db.insert(files).values({
        name: req.file.originalname,
        url: uploadResult.url,
        type: req.file.mimetype.startsWith('image/') ? 'photo' : 'document',
        size: req.file.size,
        category: 'Uncategorized',
        createdAt: new Date()
      }).returning();

      res.json({
        id: fileRecord.id,
        url: uploadResult.url,
        name: fileRecord.name,
        type: fileRecord.type,
        size: fileRecord.size,
        warning: uploadResult.warning
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ 
        message: "Upload failed",
        error: err.message 
      });
    }
  });

  // Список файлов
  app.get("/api/files", async (req, res) => {
    const search = req.query.search;
    const category = req.query.category;
    const type = req.query.type;
    
    try {
      const allFiles = await db.select().from(files);
      let filtered = allFiles;
      if (search) filtered = filtered.filter(f => f.name.includes(search));
      if (category) filtered = filtered.filter(f => f.category === category);
      if (type) filtered = filtered.filter(f => f.type === type);
      
      res.json(filtered);
    } catch (err) {
      console.error("Files list error:", err);
      res.status(500).json({ message: "Failed to get files" });
    }
  });

  // Главная страница
  app.get("/", (req, res) => {
    res.send(`
      <html><body style="font-family:Arial;padding:30px">
        <h1>☁️ Cloud Vault</h1>
        <p>✅ Перенесен с Replit на Render.com</p>
        <p>🆓 Теперь работает бесплатно!</p>
        <h3>API:</h3>
        <ul>
          <li><a href="/api/files">/api/files</a> - Файлы</li>
          <li><a href="/api/register">/api/register</a> - Регистрация</li>
          <li><a href="/api/login">/api/login</a> - Логин</li>
          <li><a href="/api/admin/stats">/api/admin/stats</a> - Статистика (x-user-id: 1)</li>
        </ul>
      </body></html>
    `);
  });

  // Создание админа
  try {
    const adminExists = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.role, 'admin'),
    }).catch(() => null);
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.insert(users).values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
      }).catch(() => {});
      console.log('✅ Админ создан: admin / admin123');
    }
  } catch (error) {
    console.log('⚠️ Не удалось создать админа');
  }

  return httpServer;
}
