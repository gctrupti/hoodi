require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const requestsRoutes = require('./routes/requests.routes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Health check - visit this in a browser to confirm the server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CommunityCare API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/requests', requestsRoutes);

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
