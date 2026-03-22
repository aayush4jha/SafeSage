const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db');
const { calculateRoadSafetyScore } = require('../ai/safetyScoreEngine');
const { auth, optionalAuth } = require('../middleware/auth');

function generateCircleCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── POST /api/family/circle/create ───
router.post('/circle/create', auth, async (req, res) => {
  try {
    const circleName = req.body.name?.trim() || 'My Safety Circle';

    const { data: user } = await supabase.from('users')
      .select('id, name, email').eq('id', req.userId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    let code, attempts = 0;
    while (attempts < 10) {
      code = generateCircleCode();
      const { data: existing } = await supabase.from('family_networks')
        .select('id').eq('circle_code', code).single();
      if (!existing) break;
      attempts++;
    }

    const { data: circle, error } = await supabase.from('family_networks').insert({
      owner_id: req.userId, network_name: circleName, circle_code: code,
    }).select().single();
    if (error) throw error;

    await supabase.from('family_members').insert({
      network_id: circle.id, name: user.name, email: user.email,
      relationship: 'Creator', status: 'active', linked_user_id: req.userId,
    });

    res.status(201).json({
      message: 'Circle created! Share the code with your family.',
      circle: { id: circle.id, name: circleName, code },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/family/circle/join ───
router.post('/circle/join', auth, async (req, res) => {
  try {
    const { code, relationship } = req.body;
    if (!code || code.trim().length !== 6) {
      return res.status(400).json({ error: 'A valid 6-digit circle code is required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const { data: circle } = await supabase.from('family_networks')
      .select('id, network_name, owner_id, circle_code')
      .eq('circle_code', cleanCode).single();

    if (!circle) return res.status(404).json({ error: 'No circle found with this code.' });

    const { data: user } = await supabase.from('users')
      .select('id, name, email').eq('id', req.userId).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: existing } = await supabase.from('family_members')
      .select('id').eq('network_id', circle.id).eq('linked_user_id', req.userId).single();
    if (existing) return res.status(400).json({ error: 'You are already in this circle.' });

    await supabase.from('family_members').insert({
      network_id: circle.id, name: user.name, email: user.email,
      relationship: relationship || 'Member', status: 'active', linked_user_id: req.userId,
    });

    res.status(201).json({
      message: `You joined "${circle.network_name}"!`,
      circle: { id: circle.id, name: circle.network_name },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/family/circle/leave — Leave a circle (non-owner) ───
router.post('/circle/leave', auth, async (req, res) => {
  try {
    const { circleId } = req.body;
    if (!circleId) return res.status(400).json({ error: 'circleId is required' });

    // Check if user is the owner — owners can't leave, they must delete
    const { data: circle } = await supabase.from('family_networks')
      .select('owner_id').eq('id', circleId).single();
    if (!circle) return res.status(404).json({ error: 'Circle not found' });
    if (circle.owner_id === req.userId) {
      return res.status(400).json({ error: 'You are the owner. Use "Delete Circle" instead.' });
    }

    await supabase.from('family_members')
      .delete().eq('network_id', circleId).eq('linked_user_id', req.userId);

    res.json({ message: 'You left the circle.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE /api/family/circle/:id — Delete a circle (owner only) ───
router.delete('/circle/:id', auth, async (req, res) => {
  try {
    const circleId = req.params.id;

    const { data: circle } = await supabase.from('family_networks')
      .select('owner_id').eq('id', circleId).single();
    if (!circle) return res.status(404).json({ error: 'Circle not found' });
    if (circle.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Only the circle owner can delete it.' });
    }

    // Delete all members first, then the circle
    await supabase.from('family_members').delete().eq('network_id', circleId);
    await supabase.from('family_safety_alerts').delete().eq('network_id', circleId);
    await supabase.from('family_networks').delete().eq('id', circleId);

    res.json({ message: 'Circle deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/family/network ───
router.get('/network', auth, async (req, res) => {
  try {
    const { data: memberships } = await supabase.from('family_members')
      .select('network_id').eq('linked_user_id', req.userId);

    const networkIds = [...new Set((memberships || []).map(m => m.network_id))];

    if (networkIds.length === 0) {
      return res.json({ circles: [], members: [], safetyAlerts: [] });
    }

    const { data: circles } = await supabase.from('family_networks')
      .select('*').in('id', networkIds);

    const { data: allMembers } = await supabase.from('family_members')
      .select('*').in('network_id', networkIds);

    const { data: alerts } = await supabase.from('family_safety_alerts')
      .select('*').in('network_id', networkIds)
      .order('created_at', { ascending: false }).limit(20);

    const otherMembers = (allMembers || []).filter(m => m.linked_user_id !== req.userId);

    res.json({
      circles: (circles || []).map(c => ({
        id: c.id,
        name: c.network_name || 'Safety Circle',
        // Only the owner can see the join code
        code: c.owner_id === req.userId ? c.circle_code : null,
        isOwner: c.owner_id === req.userId,
        memberCount: (allMembers || []).filter(m => m.network_id === c.id).length,
      })),
      members: otherMembers.map(m => ({
        _id: m.id, name: m.name, email: m.email,
        relationship: m.relationship, status: m.status,
        circleId: m.network_id,
        linkedUserId: m.linked_user_id,
        lastLocation: {
          type: 'Point',
          coordinates: [m.last_longitude || 0, m.last_latitude || 0],
        },
        lastLocationTimestamp: m.last_location_at,
        safetyScore: m.safety_score, areaRiskLevel: m.area_risk_level,
        movementStatus: m.movement_status,
        lastActivityTimestamp: m.last_activity_at || m.created_at,
        isInDangerZone: m.is_in_danger_zone, trackingEnabled: m.tracking_enabled,
      })),
      safetyAlerts: (alerts || []).map(a => ({
        memberId: a.member_id, memberName: a.member_name,
        alertType: a.alert_type, message: a.message,
        severity: a.severity, location: { coordinates: [a.longitude, a.latitude] },
        timestamp: a.created_at, acknowledged: a.acknowledged,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/family/location-update — Store user's latest location ───
router.post('/location-update', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // Update this user's location in ALL family_members rows they belong to
    const { error } = await supabase.from('family_members')
      .update({
        last_latitude: lat,
        last_longitude: lng,
        last_location_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('linked_user_id', req.userId);

    if (error) throw error;

    // Compute safety score for the location
    const { data } = await supabase.from('safety_reports').select('*').limit(200);
    const reports = (data || []).map(r => ({
      _id: r.id,
      location: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      category: r.category, severity: r.severity, timestamp: r.created_at,
    }));
    const hour = new Date().getHours();
    const timeOfDay = hour < 5 ? 'late_night' : hour < 7 ? 'early_morning' : hour < 17 ? 'day' : hour < 20 ? 'evening' : 'night';
    const score = calculateRoadSafetyScore(lat, lng, timeOfDay, reports);

    // Update safety score and risk level
    await supabase.from('family_members')
      .update({
        safety_score: score.totalScore,
        area_risk_level: score.riskLevel,
      })
      .eq('linked_user_id', req.userId);

    res.json({ updated: true, safetyScore: score.totalScore, riskLevel: score.riskLevel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/acknowledge-alert', auth, async (req, res) => {
  try {
    const { alertId } = req.body;
    if (alertId) {
      await supabase.from('family_safety_alerts').update({ acknowledged: true }).eq('id', alertId);
    }
    res.json({ acknowledged: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
