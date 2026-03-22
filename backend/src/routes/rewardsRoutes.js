const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db');
const { auth } = require('../middleware/auth');
const {
  TIERS, TIER_ORDER,
  getOrCreateRewards,
  awardCredits,
  updateStreak,
  calculateImpact,
  generateBounties,
  onReferralSignup,
} = require('../ai/rewardsEngine');

// ============================================================
// GET /api/rewards/profile — user's full rewards profile
// ============================================================
router.get('/profile', auth, async (req, res) => {
  try {
    const rewards = await getOrCreateRewards(req.userId);
    const tierDef = TIERS[rewards.tier] || TIERS.scout;

    // Next tier info
    const currentIdx = TIER_ORDER.indexOf(rewards.tier);
    let nextTier = null;
    if (currentIdx < TIER_ORDER.length - 1) {
      const nextTierKey = TIER_ORDER[currentIdx + 1];
      const nextDef = TIERS[nextTierKey];
      nextTier = {
        key: nextTierKey,
        label: nextDef.label,
        creditsRequired: nextDef.min,
        creditsRemaining: Math.max(0, nextDef.min - (rewards.lifetime_credits || 0)),
        progress: Math.min(100, Math.round(((rewards.lifetime_credits || 0) / nextDef.min) * 100)),
      };
    }

    res.json({
      credits: rewards.credits || 0,
      lifetimeCredits: rewards.lifetime_credits || 0,
      tier: rewards.tier,
      tierLabel: tierDef.label,
      tierIcon: tierDef.icon,
      tierMultiplier: tierDef.multiplier,
      streakMultiplier: rewards.streak_multiplier || 1.0,
      currentStreak: rewards.current_streak || 0,
      longestStreak: rewards.longest_streak || 0,
      lastActivityDate: rewards.last_activity_date,
      referralCode: rewards.referral_code,
      referralCount: rewards.referral_count || 0,
      reportsSubmitted: rewards.reports_submitted || 0,
      reportsVerified: rewards.reports_verified || 0,
      bountiesCompleted: rewards.bounties_completed || 0,
      nextTier,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/rewards/impact — impact dashboard stats
// ============================================================
router.get('/impact', auth, async (req, res) => {
  try {
    const impact = await calculateImpact(req.userId);
    res.json(impact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/rewards/transactions — credit history
// ============================================================
router.get('/transactions', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/rewards/challenges — active weekly challenges
// ============================================================
router.get('/challenges', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: challenges, error } = await supabase
      .from('weekly_challenges')
      .select('*')
      .eq('is_active', true)
      .lte('week_start', today)
      .gte('week_end', today);

    if (error) throw error;

    // Get user progress for each challenge
    const challengeIds = (challenges || []).map(c => c.id);
    const { data: progress } = await supabase
      .from('user_challenge_progress')
      .select('*')
      .eq('user_id', req.userId)
      .in('challenge_id', challengeIds.length > 0 ? challengeIds : ['00000000-0000-0000-0000-000000000000']);

    const progressMap = {};
    (progress || []).forEach(p => { progressMap[p.challenge_id] = p; });

    const result = (challenges || []).map(c => ({
      ...c,
      currentCount: progressMap[c.id]?.current_count || 0,
      completed: progressMap[c.id]?.completed || false,
      completedAt: progressMap[c.id]?.completed_at,
      progress: Math.min(100, Math.round(((progressMap[c.id]?.current_count || 0) / c.target_count) * 100)),
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/rewards/bounties — available verification bounties
// ============================================================
router.get('/bounties', auth, async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;

    let query = supabase
      .from('verification_bounties')
      .select('*')
      .in('status', ['open', 'claimed'])
      .gt('expires_at', new Date().toISOString())
      .order('reward_credits', { ascending: false })
      .limit(20);

    const { data, error } = await query;
    if (error) throw error;

    // If lat/lng provided, sort by distance
    let bounties = data || [];
    if (lat && lng) {
      const centerLat = parseFloat(lat);
      const centerLng = parseFloat(lng);
      bounties = bounties.map(b => ({
        ...b,
        distance: haversineM(centerLat, centerLng, b.latitude, b.longitude),
      })).sort((a, b) => a.distance - b.distance);

      if (radius) {
        const radiusM = parseFloat(radius) * 1000;
        bounties = bounties.filter(b => b.distance <= radiusM);
      }
    }

    res.json(bounties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/rewards/bounties/:id/claim — claim a bounty
// ============================================================
router.post('/bounties/:id/claim', auth, async (req, res) => {
  try {
    const { data: bounty, error } = await supabase
      .from('verification_bounties')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !bounty) return res.status(404).json({ error: 'Bounty not found' });
    if (bounty.status !== 'open') return res.status(400).json({ error: 'Bounty is not available' });
    if (new Date(bounty.expires_at) < new Date()) return res.status(400).json({ error: 'Bounty has expired' });

    const { error: updateErr } = await supabase
      .from('verification_bounties')
      .update({
        status: 'claimed',
        claimed_by: req.userId,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (updateErr) throw updateErr;
    res.json({ message: 'Bounty claimed! Submit a report at this location to complete it.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/rewards/bounties/:id/complete — complete a bounty with a report
// ============================================================
router.post('/bounties/:id/complete', auth, async (req, res) => {
  try {
    const { reportId } = req.body;
    const { data: bounty } = await supabase
      .from('verification_bounties')
      .select('*')
      .eq('id', req.params.id)
      .eq('claimed_by', req.userId)
      .eq('status', 'claimed')
      .single();

    if (!bounty) return res.status(404).json({ error: 'Bounty not found or not claimed by you' });

    await supabase
      .from('verification_bounties')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        report_id: reportId,
      })
      .eq('id', req.params.id);

    // Award bounty credits
    const { awardCredits } = require('../ai/rewardsEngine');
    await awardCredits(req.userId, bounty.reward_credits, 'bounty_completed',
      'Verification bounty completed!', bounty.id);

    // Update stat
    const { incrementStat } = require('../ai/rewardsEngine');
    await incrementStat(req.userId, 'bounties_completed');

    res.json({ message: 'Bounty completed!', creditsEarned: bounty.reward_credits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/rewards/bounties/generate — generate new bounties (admin/cron)
// ============================================================
router.post('/bounties/generate', async (req, res) => {
  try {
    const bounties = await generateBounties();
    res.json({ generated: bounties.length, bounties });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/rewards/leaderboard — leaderboard
// ============================================================
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'monthly', scope = 'global', limit = 20 } = req.query;

    // Real-time leaderboard from user_rewards
    let query = supabase
      .from('user_rewards')
      .select('user_id, lifetime_credits, tier, current_streak, reports_submitted, referral_count')
      .order('lifetime_credits', { ascending: false })
      .limit(parseInt(limit));

    const { data: rewards, error } = await query;
    if (error) throw error;

    // Get user names
    const userIds = (rewards || []).map(r => r.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    const nameMap = {};
    (users || []).forEach(u => { nameMap[u.id] = u.name; });

    const leaderboard = (rewards || []).map((r, idx) => ({
      rank: idx + 1,
      userId: r.user_id,
      name: nameMap[r.user_id] || 'Anonymous',
      tier: r.tier,
      tierLabel: (TIERS[r.tier] || TIERS.scout).label,
      lifetimeCredits: r.lifetime_credits || 0,
      reportsCount: r.reports_submitted || 0,
      currentStreak: r.current_streak || 0,
    }));

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Zone Adoption endpoints
// ============================================================

// GET /api/rewards/zones — user's adopted zones
router.get('/zones', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('zone_adoptions')
      .select('*')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rewards/zones/adopt — adopt a zone
router.post('/zones/adopt', auth, async (req, res) => {
  try {
    const { zoneName, latitude, longitude, radiusMeters = 500 } = req.body;
    if (!zoneName || !latitude || !longitude) {
      return res.status(400).json({ error: 'zoneName, latitude, and longitude are required' });
    }

    // Max 3 active zones per user
    const { count } = await supabase
      .from('zone_adoptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('is_active', true);

    if (count >= 3) {
      return res.status(400).json({ error: 'Maximum 3 active zones allowed. Deactivate one first.' });
    }

    const { data, error } = await supabase
      .from('zone_adoptions')
      .insert({
        user_id: req.userId,
        zone_name: zoneName,
        center_latitude: parseFloat(latitude),
        center_longitude: parseFloat(longitude),
        radius_meters: parseInt(radiusMeters),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/rewards/zones/:id — deactivate a zone
router.delete('/zones/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('zone_adoptions')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Zone deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/rewards/redeem — redeem credits
// ============================================================
router.post('/redeem', auth, async (req, res) => {
  try {
    const { amount, redeemType = 'general' } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const rewards = await getOrCreateRewards(req.userId);
    if ((rewards.credits || 0) < amount) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    await supabase
      .from('user_rewards')
      .update({
        credits: rewards.credits - amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.userId);

    await supabase.from('credit_transactions').insert({
      user_id: req.userId,
      amount: -amount,
      type: 'redemption',
      description: `Redeemed ${amount} credits (${redeemType})`,
    });

    res.json({ message: `Successfully redeemed ${amount} credits`, remainingCredits: rewards.credits - amount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/rewards/apply-referral — apply referral code during signup
// ============================================================
router.post('/apply-referral', auth, async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ error: 'Referral code required' });

    // Find referrer
    const { data: referrer } = await supabase
      .from('user_rewards')
      .select('user_id')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    if (referrer.user_id === req.userId) return res.status(400).json({ error: 'Cannot use your own referral code' });

    // Check if user already has a referrer
    const { data: myRewards } = await supabase
      .from('user_rewards')
      .select('referred_by')
      .eq('user_id', req.userId)
      .single();

    if (myRewards?.referred_by) return res.status(400).json({ error: 'Referral already applied' });

    await onReferralSignup(referrer.user_id, req.userId);
    res.json({ message: 'Referral applied! Both you and the referrer earned credits.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/rewards/tiers — tier definitions
// ============================================================
router.get('/tiers', (req, res) => {
  const tiers = TIER_ORDER.map(key => ({
    key,
    ...TIERS[key],
  }));
  res.json(tiers);
});

// ============================================================
// GET /api/rewards/store — redemption catalog (dummy data for now)
// ============================================================
router.get('/store', (req, res) => {
  const store = [
    // Partner Coupons
    {
      id: 'coupon_uber_night',
      category: 'partner_coupons',
      name: 'Uber Night Ride - 20% Off',
      description: 'Get 20% off on any Uber ride between 8 PM and 6 AM. Stay safe while traveling at night.',
      cost: 200,
      icon: 'directions_car',
      partner: 'Uber',
      validUntil: '2026-06-30',
      terms: 'Valid on rides starting between 8 PM - 6 AM. Max discount INR 100. One use per account.',
    },
    {
      id: 'coupon_ola_safe',
      category: 'partner_coupons',
      name: 'Ola Safe Ride - 15% Off',
      description: '15% discount on Ola rides with the "Guardian" safety feature enabled.',
      cost: 150,
      icon: 'local_taxi',
      partner: 'Ola',
      validUntil: '2026-06-30',
      terms: 'Valid on Ola Mini, Prime & SUV. Max discount INR 80. Must enable Guardian mode.',
    },
    {
      id: 'coupon_pepper_spray',
      category: 'partner_coupons',
      name: 'SafeGuard Pepper Spray - 30% Off',
      description: 'Premium compact pepper spray with UV marking dye. Fits in your pocket.',
      cost: 300,
      icon: 'shield',
      partner: 'SafeGuard',
      validUntil: '2026-12-31',
      terms: 'Delivered to your address. Available in select cities. Age 18+ only.',
    },
    {
      id: 'coupon_safety_alarm',
      category: 'partner_coupons',
      name: 'Personal Safety Alarm - 25% Off',
      description: '130dB personal alarm keychain. One pull activates a loud siren + flashing light.',
      cost: 250,
      icon: 'campaign',
      partner: 'AlertMe',
      validUntil: '2026-12-31',
      terms: 'Free shipping on orders above INR 500. Battery included.',
    },
    {
      id: 'coupon_self_defense',
      category: 'partner_coupons',
      name: 'Self-Defense Class - 1 Free Session',
      description: 'One free introductory self-defense class at partner studios near you.',
      cost: 400,
      icon: 'sports_martial_arts',
      partner: 'DefendHer',
      validUntil: '2026-06-30',
      terms: 'Available in Delhi, Mumbai, Bangalore, Hyderabad. Book within 30 days of redemption.',
    },

    // Gift Cards / Recharges
    {
      id: 'gift_amazon_100',
      category: 'gift_cards',
      name: 'Amazon Gift Card - INR 100',
      description: 'Redeemable on Amazon.in for any purchase.',
      cost: 500,
      icon: 'card_giftcard',
      partner: 'Amazon',
      validUntil: '2027-01-01',
      terms: 'E-gift card delivered to your registered email. Non-refundable.',
    },
    {
      id: 'gift_recharge_50',
      category: 'gift_cards',
      name: 'Mobile Recharge - INR 50',
      description: 'Instant mobile recharge for any operator.',
      cost: 250,
      icon: 'phone_android',
      partner: 'SafeSage',
      validUntil: '2027-01-01',
      terms: 'Enter your mobile number during redemption. All operators supported.',
    },
    {
      id: 'gift_swiggy_75',
      category: 'gift_cards',
      name: 'Swiggy Voucher - INR 75',
      description: 'Order food or groceries on Swiggy.',
      cost: 350,
      icon: 'restaurant',
      partner: 'Swiggy',
      validUntil: '2026-12-31',
      terms: 'Minimum order INR 199. One use only.',
    },

    // Premium Features
    {
      id: 'premium_family_slots',
      category: 'premium_features',
      name: 'Extra Family Circle Slots (+3)',
      description: 'Add 3 more members to your Safety Circle beyond the default limit.',
      cost: 300,
      icon: 'group_add',
      partner: 'SafeSage',
      validUntil: null,
      terms: 'Permanent unlock. Applied to your account immediately.',
    },
    {
      id: 'premium_route_priority',
      category: 'premium_features',
      name: 'Priority Safe Routes (30 days)',
      description: 'Get priority route calculations with real-time crowd data and police patrol schedules.',
      cost: 400,
      icon: 'alt_route',
      partner: 'SafeSage',
      validUntil: null,
      terms: '30-day access from date of redemption. Auto-expires.',
    },
    {
      id: 'premium_report_analytics',
      category: 'premium_features',
      name: 'Detailed Area Analytics (30 days)',
      description: 'See hourly safety breakdown, historical trends, and incident heatmap layers for any area.',
      cost: 350,
      icon: 'analytics',
      partner: 'SafeSage',
      validUntil: null,
      terms: '30-day access. Includes downloadable reports.',
    },
    {
      id: 'premium_emergency_priority',
      category: 'premium_features',
      name: 'Priority Emergency Response (30 days)',
      description: 'Your emergency alerts get flagged as high-priority with faster notification delivery.',
      cost: 500,
      icon: 'emergency',
      partner: 'SafeSage',
      validUntil: null,
      terms: '30-day access. Stacks with existing emergency features.',
    },
  ];

  res.json(store);
});

// ============================================================
// POST /api/rewards/store/redeem — redeem a store item
// ============================================================
router.post('/store/redeem', auth, async (req, res) => {
  try {
    const { itemId, itemName, cost } = req.body;
    if (!itemId || !cost) return res.status(400).json({ error: 'itemId and cost are required' });

    const rewards = await getOrCreateRewards(req.userId);
    if ((rewards.credits || 0) < cost) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Deduct credits
    await supabase
      .from('user_rewards')
      .update({
        credits: rewards.credits - cost,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.userId);

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id: req.userId,
      amount: -cost,
      type: 'redemption',
      description: `Redeemed: ${itemName || itemId}`,
    });

    res.json({
      message: `Successfully redeemed "${itemName || itemId}"!`,
      remainingCredits: rewards.credits - cost,
      redemptionCode: `SS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/rewards/notifications — recent reward events for the user
// ============================================================
router.get('/notifications', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('id, amount, type, description, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Mark which ones are "new" (last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const notifications = (data || []).map(txn => ({
      ...txn,
      isNew: txn.created_at > fiveMinAgo,
    }));

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// HELPERS
// ============================================================
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
