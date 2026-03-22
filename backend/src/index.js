require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');

const safetyRoutes = require('./routes/safetyRoutes');
const routeRoutes = require('./routes/routeRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const userRoutes = require('./routes/userRoutes');
const familyRoutes = require('./routes/familyRoutes');
const codewordRoutes = require('./routes/codewordRoutes');
const rewardsRoutes = require('./routes/rewardsRoutes');
const { analyzeImage } = require('./ai/imageAnalyzer');
const { generateChallenges } = require('./jobs/challengeGenerator');
const { generateBountiesJob } = require('./jobs/bountyGenerator');
const { setIO } = require('./ai/rewardsEngine');

const app = express();
const httpServer = createServer(app);


const io = new Server(httpServer, {
  cors: {
    origin: ['https://safesage-frontend.vercel.app', 'http://localhost:3001'],
    methods: ['GET', 'POST']
  }
});
// Store io instance for routes and rewards engine to access
app.set('io', io);
setIO(io);

// Middleware
app.use(cors({
  origin: ['https://safesage-frontend.vercel.app', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Also update Socket.IO cors:

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Routes
app.use('/api', safetyRoutes);
app.use('/api', routeRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/codeword', codewordRoutes);
app.use('/api/rewards', rewardsRoutes);

// Image upload and analysis endpoint
app.post('/api/reports/verify-image', express.raw({ type: ['image/*'], limit: '10mb' }), async (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    const analysis = await analyzeImage(req.body);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Base64 image analysis endpoint (easier for frontend)
app.post('/api/reports/analyze-image', async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: 'No imageData provided' });
    }
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const analysis = await analyzeImage(buffer);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NightShield AI Backend',
    version: '2.0',
    features: ['safety-heatmap', 'safe-routes', 'emergency-sos', 'family-network', 'voice-guardian', 'codeword-system', 'image-verification', 'escalation-engine', 'rewards-system'],
    timestamp: new Date().toISOString()
  });
});

// Socket.io real-time events
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-tracking', (data) => {
    const room = `tracking-${data.userId || socket.id}`;
    socket.join(room);
    console.log(`${socket.id} joined room ${room}`);
  });

  socket.on('location-update', (data) => {
    const room = `tracking-${data.userId || socket.id}`;
    io.to(room).emit('location-update', {
      lat: data.lat,
      lng: data.lng,
      timestamp: new Date(),
      socketId: socket.id
    });
  });

  socket.on('emergency-alert', (data) => {
    io.emit('emergency-alert', {
      ...data,
      socketId: socket.id,
      timestamp: new Date()
    });
  });

  socket.on('alert-resolved', (data) => {
    io.emit('alert-resolved', {
      alertId: data.alertId,
      timestamp: new Date()
    });
  });

  // Family network events
  socket.on('join-family-network', (data) => {
    const room = `family-${data.networkId || data.userId || socket.id}`;
    socket.join(room);
  });

  socket.on('family-location-update', (data) => {
    const room = `family-${data.networkId || socket.id}`;
    io.to(room).emit('family-member-update', {
      memberId: data.memberId,
      lat: data.lat,
      lng: data.lng,
      movementStatus: data.movementStatus,
      safetyScore: data.safetyScore,
      timestamp: new Date()
    });
  });

  socket.on('escalation-event', (data) => {
    const room = `family-${data.networkId || socket.id}`;
    io.to(room).emit('escalation-update', {
      ...data,
      timestamp: new Date()
    });
  });

  // Rewards notification room
  socket.on('join-rewards', (data) => {
    const room = `rewards-${data.userId || socket.id}`;
    socket.join(room);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

// Get local IP for LAN access
function getLocalIP() {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// ============================================================
// Scheduled Jobs — Challenges & Bounties
// ============================================================
function startScheduledJobs() {
  // Generate challenges on startup, then every 1 hour
  generateChallenges().catch(e => console.error('[Scheduler] Challenge init error:', e.message));
  setInterval(() => {
    generateChallenges().catch(e => console.error('[Scheduler] Challenge error:', e.message));
  }, 60 * 60 * 1000); // every 1 hour

  // Generate bounties on startup, then every 2 hours
  generateBountiesJob().catch(e => console.error('[Scheduler] Bounty init error:', e.message));
  setInterval(() => {
    generateBountiesJob().catch(e => console.error('[Scheduler] Bounty error:', e.message));
  }, 2 * 60 * 60 * 1000); // every 2 hours

  console.log('  Scheduled: Challenges (1h) | Bounties (2h)');
}

connectDB()
  .then(() => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      const ip = getLocalIP();
      console.log(`\n  NightShield AI Backend v2.0`);
      console.log(`  Local:   http://localhost:${PORT}/api`);
      console.log(`  Network: http://${ip}:${PORT}/api`);
      console.log(`  Health:  http://localhost:${PORT}/api/health`);
      startScheduledJobs();
      console.log('');
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    httpServer.listen(PORT, '0.0.0.0', () => {
      const ip = getLocalIP();
      console.log(`\n  NightShield AI Backend v2.0 (NO DATABASE)`);
      console.log(`  Local:   http://localhost:${PORT}`);
      console.log(`  Network: http://${ip}:${PORT}`);
      console.log(`  Warning: MongoDB not connected. Using demo data.\n`);
    });
  });
