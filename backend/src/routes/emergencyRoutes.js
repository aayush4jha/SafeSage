const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db');
const { analyzeMovement, detectPanicMovement } = require('../ai/movementAnalyzer');
const { optionalAuth } = require('../middleware/auth');

// POST /api/emergency/alert
router.post('/alert', optionalAuth, async (req, res) => {
  try {
    const { latitude, longitude, triggerType = 'manual' } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const { data, error } = await supabase.from('emergency_alerts').insert({
      user_id: req.userId || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      location: `POINT(${longitude} ${latitude})`,
      trigger_type: triggerType,
      status: 'active',
      location_history: [{ lat: latitude, lng: longitude, timestamp: new Date() }],
    }).select().single();

    if (error) throw error;

    const io = req.app.get('io');

    // Notify all family circle members via in-app notification
    if (req.userId) {
      try {
        // Get user info
        const { data: user } = await supabase.from('users')
          .select('name, email').eq('id', req.userId).single();
        const userName = user?.name || 'A family member';

        // Find all circles this user belongs to
        const { data: memberships } = await supabase.from('family_members')
          .select('network_id').eq('linked_user_id', req.userId);

        const networkIds = [...new Set((memberships || []).map(m => m.network_id))];

        for (const networkId of networkIds) {
          // Insert a safety alert for each circle
          await supabase.from('family_safety_alerts').insert({
            network_id: networkId,
            member_id: req.userId,
            member_name: userName,
            alert_type: 'emergency_sos',
            message: `${userName} triggered an Emergency SOS! Location: ${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)}`,
            severity: 'critical',
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            acknowledged: false,
          });

          // Emit socket event to family room so online members see it instantly
          if (io) {
            io.to(`family-${networkId}`).emit('family-emergency-alert', {
              alertId: data.id,
              memberId: req.userId,
              memberName: userName,
              location: { lat: parseFloat(latitude), lng: parseFloat(longitude) },
              message: `${userName} triggered an Emergency SOS!`,
              severity: 'critical',
              timestamp: new Date(),
            });
          }
        }
      } catch (notifyErr) {
        console.error('Failed to notify family circles:', notifyErr.message);
      }
    }

    // Broadcast global emergency alert
    if (io) {
      io.emit('emergency-alert', {
        alertId: data.id,
        location: { lat: latitude, lng: longitude },
        triggerType,
        timestamp: new Date()
      });
    }

    // Return nearby police stations with phone numbers (Google Places API or fallback)
    const { getNearbyServices } = require('../ai/escalationEngine');
    const nearbyServices = await getNearbyServices(parseFloat(latitude), parseFloat(longitude));

    res.status(201).json({ message: 'Emergency alert triggered', alert: data, nearbyServices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/emergency/alert/:id/resolve
router.put('/alert/:id/resolve', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('emergency_alerts')
      .update({ status: req.body.status || 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Alert not found' });

    if (req.app.get('io')) {
      req.app.get('io').emit('alert-resolved', { alertId: data.id });
    }

    res.json({ message: 'Alert resolved', alert: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/emergency/movement-check
router.post('/movement-check', async (req, res) => {
  try {
    const { locationHistory } = req.body;
    if (!locationHistory || locationHistory.length < 2) {
      return res.status(400).json({ error: 'At least 2 location points required' });
    }
    const analysis = analyzeMovement(locationHistory);
    const panicCheck = detectPanicMovement(locationHistory);
    res.json({
      movement: analysis,
      panic: panicCheck,
      shouldAlert: analysis.anomalyScore > 70 || panicCheck.isPanic
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emergency/active
router.get('/active', optionalAuth, async (req, res) => {
  try {
    let query = supabase.from('emergency_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);

    if (req.userId) {
      query = query.eq('user_id', req.userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emergency/history
router.get('/history', optionalAuth, async (req, res) => {
  try {
    let query = supabase.from('emergency_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (req.userId) {
      query = query.eq('user_id', req.userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/emergency/photos — receive SOS camera captures and forward to family circles
router.post('/photos', optionalAuth, async (req, res) => {
  try {
    const { photos } = req.body;
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: 'photos array is required' });
    }

    const io = req.app.get('io');

    if (req.userId && io) {
      // Get user info
      const { data: user } = await supabase.from('users')
        .select('name').eq('id', req.userId).single();
      const userName = user?.name || 'A family member';

      // Find all circles this user belongs to
      const { data: memberships } = await supabase.from('family_members')
        .select('network_id').eq('linked_user_id', req.userId);

      const networkIds = [...new Set((memberships || []).map(m => m.network_id))];

      // Emit photos to all family circles via socket
      for (const networkId of networkIds) {
        io.to(`family-${networkId}`).emit('family-emergency-photos', {
          memberId: req.userId,
          memberName: userName,
          photos,
          timestamp: new Date(),
        });
      }
    }

    res.json({ message: 'Photos sent to emergency contacts', count: photos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
