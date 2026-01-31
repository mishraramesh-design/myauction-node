const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = require('./config/database');
const config = require('./config/config');

// Import routes
const authRoutes = require('./routes/auth');
const tenderRoutes = require('./routes/tenders');
const bidRoutes = require('./routes/bids');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: process.env.CORS_ORIGINS || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database schema
const initDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_tender', (tenderId) => {
    socket.join(`tender_${tenderId}`);
    console.log(`Socket ${socket.id} joined tender ${tenderId}`);
  });

  socket.on('leave_tender', (tenderId) => {
    socket.leave(`tender_${tenderId}`);
    console.log(`Socket ${socket.id} left tender ${tenderId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// Start server
const PORT = process.env.PORT || 8001;

initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ Reverse Auction Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Max items per tender: ${config.tender.maxItemsPerTender}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    pool.end();
    console.log('Server closed');
    process.exit(0);
  });
});
