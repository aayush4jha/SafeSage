const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/db');
const { evaluateEscalation, shouldTriggerChallenge, getNearbyServices, getStageConfig } = require('../ai/escalationEngine');
const { optionalAuth } = require('../middleware/auth');

// POST /api/codeword/setup
router.post('/setup', optionalAuth, async (req, res) => {
  try {
    const { codeword } = req.body;
    if (!codeword || codeword.length < 3) {
      return res.status(400).json({ error: 'Codeword must be at least 3 characters' });
    }

    const userId = req.userId || 'demo_user';
    const hash = await bcrypt.hash(codeword, 10);

    const { data: existing } = await supabase.from('safety_codewords').select('id').eq('user_id', userId).single();

    if (existing) {
      await supabase.from('safety_codewords').update({ codeword_hash: hash }).eq('id', existing.id);
    } else {
      await supabase.from('safety_codewords').insert({ user_id: userId, codeword_hash: hash });
    }

    res.json({ message: 'Codeword set up successfully', isEnabled: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/codeword/verify
router.post('/verify', optionalAuth, async (req, res) => {
  try {
    const { codeword, lat, lng } = req.body;
    const userId = req.userId || 'demo_user';

    const { data: record } = await supabase.from('safety_codewords').select('*').eq('user_id', userId).single();
    if (!record) return res.json({ verified: true, message: 'No codeword configured' });

    const isCorrect = await bcrypt.compare(codeword, record.codeword_hash);

    if (isCorrect) {
      await supabase.from('safety_codewords').update({
        escalation_stage: 0, reminder_count: 0,
        is_recording: false, contacts_notified: false, resolved: true,
      }).eq('id', record.id);
      return res.json({ verified: true, message: 'You are safe. Escalation cancelled.', stage: 0 });
    }

    const nextStage = Math.min(6, (record.escalation_stage || 0) + 1);
    await supabase.from('safety_codewords').update({
      escalation_stage: nextStage,
      reminder_count: (record.reminder_count || 0) + 1,
      resolved: false,
      last_reminder_at: new Date().toISOString(),
    }).eq('id', record.id);

    res.json({
      verified: false,
      message: 'Incorrect codeword. Escalation increased.',
      stage: nextStage,
      action: getStageConfig(nextStage).action,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check-area', optionalAuth, async (req, res) => {
  try {
    const { areaRiskLevel, movementStatus, timeInArea } = req.body;
    res.json({
      shouldChallenge: shouldTriggerChallenge(areaRiskLevel || 'moderate', movementStatus || 'walking', timeInArea || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/escalate', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, currentStage } = req.body;
    const stage = Math.min(6, (currentStage || 0) + 1);
    const config = getStageConfig(stage);
    const response = { stage, action: config.action };

    if (stage >= 5) {
      response.nearbyServices = await getNearbyServices(lat || 23.0225, lng || 72.5714);
    }
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', optionalAuth, async (req, res) => {
  try {
    const userId = req.userId || 'demo_user';
    const { data: record } = await supabase.from('safety_codewords').select('*').eq('user_id', userId).single();
    if (!record) return res.json({ hasCodeword: false, stage: 0, isEnabled: false });

    res.json({
      hasCodeword: true, isEnabled: record.is_enabled,
      stage: record.escalation_stage,
      escalationState: {
        stage: record.escalation_stage, resolved: record.resolved,
        isRecording: record.is_recording, contactsNotified: record.contacts_notified,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/nearby-services', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    const services = await getNearbyServices(parseFloat(lat) || 23.0225, parseFloat(lng) || 72.5714, parseFloat(radius) || 5);
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
