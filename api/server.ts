import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import submissionRoutes from './routes/submissions';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/test', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend service is running normally',
    version: '2026-05-26',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`LAN access: http://127.0.0.1:${port}`);
});
