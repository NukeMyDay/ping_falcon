require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { initDb } = require('./db');
const apiRoutes = require('./routes/api');
const { checkAllStatuses } = require('./services/statusChecker');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
initDb();

// API routes
app.use('/api', apiRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Poll status pages every minute
const interval = Math.max(30, parseInt(process.env.POLL_INTERVAL) || 60);
const cronExpr = interval < 60
  ? `*/${interval} * * * * *`
  : `*/${Math.floor(interval / 60)} * * * *`;

cron.schedule(cronExpr, () => {
  checkAllStatuses();
});

// Initial check on startup
checkAllStatuses();

app.listen(PORT, () => {
  console.log(`pingfalcon running on http://localhost:${PORT}`);
});
