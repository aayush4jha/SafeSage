const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/db');
const { auth } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from('users').insert({
      name, email, password_hash: passwordHash, phone: phone || '',
    }).select().single();

    if (error) throw error;

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'nightshield_jwt_secret_key_2024', { expiresIn: '30d' });
    res.status(201).json({
      message: 'Registration successful', token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'nightshield_jwt_secret_key_2024', { expiresIn: '30d' });

    // Fetch contacts
    const { data: contacts } = await supabase.from('emergency_contacts').select('*').eq('user_id', user.id);

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        phone: user.phone, emergencyContacts: contacts || [],
        safetyPreferences: user.safety_preferences,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/emergency-contacts', auth, async (req, res) => {
  try {
    const { emergencyContacts } = req.body;

    // Delete existing contacts and re-insert
    await supabase.from('emergency_contacts').delete().eq('user_id', req.userId);

    if (emergencyContacts && emergencyContacts.length > 0) {
      const rows = emergencyContacts.map(c => ({
        user_id: req.userId, name: c.name, phone: c.phone,
        email: c.email || '', relationship: c.relationship || '',
      }));
      await supabase.from('emergency_contacts').insert(rows);
    }

    const { data: contacts } = await supabase.from('emergency_contacts').select('*').eq('user_id', req.userId);
    res.json({ emergencyContacts: contacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase.from('users')
      .select('id, name, email, phone, safety_preferences, created_at')
      .eq('id', req.userId).single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });

    const { data: contacts } = await supabase.from('emergency_contacts').select('*').eq('user_id', req.userId);
    res.json({ ...user, emergencyContacts: contacts || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    // Count reports (anonymous, so count all)
    const { count: reportCount } = await supabase.from('safety_reports')
      .select('*', { count: 'exact', head: true });

    // Count resolved emergencies for this user
    const { count: emergencyCount } = await supabase.from('emergency_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    // Count emergency contacts
    const { count: contactCount } = await supabase.from('emergency_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    // Days active (since user creation)
    const { data: user } = await supabase.from('users')
      .select('created_at')
      .eq('id', req.userId).single();

    const daysActive = user
      ? Math.max(1, Math.ceil((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)))
      : 1;

    // Contribution Score Algorithm (0-100)
    // Rewards users for actively contributing to community safety
    const reports = reportCount || 0;
    const alerts = emergencyCount || 0;
    const contacts = contactCount || 0;

    const reportPts = Math.min(35, reports * 1.5);       // max 35 — filing reports helps everyone
    const daysPts = Math.min(20, daysActive * 0.3);      // max 20 — consistency & engagement
    const contactPts = Math.min(15, contacts * 5);       // max 15 — preparedness
    const alertPts = Math.min(15, alerts * 5);           // max 15 — using the system when needed
    // Location tracking bonus is computed client-side (15 pts) since it's a client state

    const contributionScore = Math.round(reportPts + daysPts + contactPts + alertPts);

    res.json({
      reportsSubmitted: reports,
      emergencyAlerts: alerts,
      emergencyContacts: contacts,
      daysActive,
      contributionScore,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
