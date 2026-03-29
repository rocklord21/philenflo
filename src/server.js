'use strict';

require('dotenv').config();

const express = require('express');
const { validateRequest } = require('./validate');
const { analyzeReply } = require('./agent');

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function requireSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Core analysis endpoint
app.post('/analyze-reply', requireSecret, async (req, res) => {
  const validated = validateRequest(req.body);

  if (!validated.ok) {
    return res.status(validated.status).json({ error: validated.error });
  }

  // Auto-reply detected before calling Claude
  if (validated.autoReply) {
    return res.json(validated.data);
  }

  try {
    const result = await analyzeReply(validated.data);
    return res.json(result);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'upstream_timeout', retry: true });
    }
    console.error('Claude API error:', err.message);
    return res.status(503).json({ error: 'upstream_failure', retry: true });
  }
});

// Test endpoint — same logic, explicitly labelled so you know it won't trigger
// any side-effects in Zapier (just hook this up to a test Zap or use curl)
app.post('/test', requireSecret, async (req, res) => {
  const validated = validateRequest(req.body);

  if (!validated.ok) {
    return res.status(validated.status).json({ error: validated.error, test: true });
  }

  if (validated.autoReply) {
    return res.json({ ...validated.data, test: true });
  }

  try {
    const result = await analyzeReply(validated.data);
    return res.json({ ...result, test: true });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'upstream_timeout', retry: true, test: true });
    }
    console.error('Claude API error (test):', err.message);
    return res.status(503).json({ error: 'upstream_failure', retry: true, test: true });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`AI SDR Reply Agent running on port ${PORT}`);
});

module.exports = app;
