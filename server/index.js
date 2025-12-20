require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());

const corsOptions = { origin: process.env.CORS_ORIGIN || '*' };
app.use(cors(corsOptions));

app.get('/api/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.post('/api/data', (req, res) => {
  // placeholder: accept JSON and echo back
  const payload = req.body;
  console.log('Received data:', payload);
  res.json({ success: true, received: payload });
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server running on port ${port}`));
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const minerRoutes = require('./routes/miner');
const githubRoutes = require('./routes/github');

const app = express();
const corsOptions = {
	origin: process.env.CORS_ORIGIN || '*'
};
app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/miner', minerRoutes);
app.use('/api/github', githubRoutes);

app.get('/api/ping', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server running on port ${port}`));
