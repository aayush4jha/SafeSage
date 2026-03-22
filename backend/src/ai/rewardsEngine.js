const { supabase } = require('../config/db');

// Reference to the Express app (set after server starts)
let _io = null;
function setIO(io) { _io = io; }
function emitRewardNotification(userId, data) {
  if (_io) {
    _io.to(`rewards-${userId}`).emit('reward-earned', data);
  }
}

// ============================================================
// CREDIT AMOUNTS
// ============================================================
const CREDITS = {
  REPORT_SUBMITTED: 10,
  REPORT_VERIFIED: 20,       // report with image verification
  REPORT_UPVOTED: 5,         // someone upvoted your report
  BOUNTY_COMPLETED: 100,     // default, actual amount from bounty record
  STREAK_BONUS_7: 25,
  STREAK_BONUS_30: 100,
  REFERRAL_SIGNUP: 50,
  REFERRAL_FIRST_REPORT: 30,
  ZONE_MONTHLY_BONUS: 75,
  WEEKLY_CHALLENGE: 50,      // default, actual amount from challenge record
  TIER_PROMOTION: 200,
};

// ============================================================
// TIER DEFINITIONS
// ============================================================
const TIERS = {
  scout:           { min: 0,    multiplier: 1.0, label: 'Scout',           icon: 'explore' },
  guardian:        { min: 200,  multiplier: 1.5, label: 'Guardian',        icon: 'shield' },
  sentinel:        { min: 800,  multiplier: 2.0, label: 'Sentinel',        icon: 'security' },
  shield_champion: { min: 2000, multiplier: 3.0, label: 'Shield Champion', icon: 'military_tech' },
};

const TIER_ORDER = ['scout', 'guardian', 'sentinel', 'shield_champion'];

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Get or create a user's rewards record
 */
async function getOrCreateRewards(userId) {
  let { data, error } = await supabase
    .from('user_rewards')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    const referralCode = generateReferralCode();
    const { data: created, error: createErr } = await supabase
      .from('user_rewards')
      .insert({
        user_id: userId,
        referral_code: referralCode,
      })
      .select()
      .single();
    if (createErr) throw createErr;
    data = created;
  }

  return data;
}

/**
 * Award credits to a user and log the transaction
 */
async function awardCredits(userId, amount, type, description = '', referenceId = null) {
  const rewards = await getOrCreateRewards(userId);

  // Apply streak multiplier
  const streakMult = rewards.streak_multiplier || 1.0;
  // Apply tier multiplier
  const tierMult = rewards.tier_multiplier || 1.0;
  const finalAmount = Math.round(amount * streakMult * tierMult);

  // Update credits
  const { error: updateErr } = await supabase
    .from('user_rewards')
    .update({
      credits: (rewards.credits || 0) + finalAmount,
      lifetime_credits: (rewards.lifetime_credits || 0) + finalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateErr) throw updateErr;

  // Log transaction
  const txn = {
    user_id: userId,
    amount: finalAmount,
    type,
    description: description || `Earned ${finalAmount} credits (${type})`,
    reference_id: referenceId,
  };
  await supabase.from('credit_transactions').insert(txn);

  // Emit real-time notification
  emitRewardNotification(userId, {
    amount: finalAmount,
    type,
    description: txn.description,
    totalCredits: (rewards.credits || 0) + finalAmount,
  });

  // Check for tier promotion
  await checkTierPromotion(userId);

  return finalAmount;
}

/**
 * Check and update user's tier based on lifetime credits
 */
async function checkTierPromotion(userId) {
  const { data: rewards } = await supabase
    .from('user_rewards')
    .select('lifetime_credits, tier')
    .eq('user_id', userId)
    .single();

  if (!rewards) return null;

  const lifetime = rewards.lifetime_credits || 0;
  let newTier = 'scout';

  for (const tier of TIER_ORDER) {
    if (lifetime >= TIERS[tier].min) {
      newTier = tier;
    }
  }

  if (newTier !== rewards.tier) {
    const tierDef = TIERS[newTier];
    await supabase
      .from('user_rewards')
      .update({
        tier: newTier,
        tier_multiplier: tierDef.multiplier,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // Award tier promotion bonus
    if (TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(rewards.tier)) {
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: CREDITS.TIER_PROMOTION,
        type: 'tier_promotion',
        description: `Promoted to ${tierDef.label}!`,
      });

      // Add the bonus credits directly (without recursion)
      await supabase.rpc('increment_credits', { uid: userId, amt: CREDITS.TIER_PROMOTION })
        .then(() => {})
        .catch(() => {
          // Fallback: manual update if RPC doesn't exist
          supabase
            .from('user_rewards')
            .select('credits, lifetime_credits')
            .eq('user_id', userId)
            .single()
            .then(({ data }) => {
              if (data) {
                supabase.from('user_rewards').update({
                  credits: data.credits + CREDITS.TIER_PROMOTION,
                  lifetime_credits: data.lifetime_credits + CREDITS.TIER_PROMOTION,
                }).eq('user_id', userId);
              }
            });
        });
    }

    return newTier;
  }

  return null;
}

/**
 * Update daily streak
 */
async function updateStreak(userId) {
  const rewards = await getOrCreateRewards(userId);
  const today = new Date().toISOString().split('T')[0];
  const lastDate = rewards.last_activity_date;

  if (lastDate === today) return rewards.current_streak; // already counted today

  let newStreak = 1;
  if (lastDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayStr) {
      newStreak = (rewards.current_streak || 0) + 1;
    }
  }

  const longestStreak = Math.max(newStreak, rewards.longest_streak || 0);

  // Calculate streak multiplier
  let streakMult = 1.0;
  if (newStreak >= 30) streakMult = 3.0;
  else if (newStreak >= 14) streakMult = 2.5;
  else if (newStreak >= 7) streakMult = 2.0;
  else if (newStreak >= 3) streakMult = 1.5;

  await supabase
    .from('user_rewards')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
      streak_multiplier: streakMult,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // Award streak bonuses at milestones
  if (newStreak === 7) {
    await awardCredits(userId, CREDITS.STREAK_BONUS_7, 'streak_bonus', '7-day streak bonus!');
  } else if (newStreak === 30) {
    await awardCredits(userId, CREDITS.STREAK_BONUS_30, 'streak_bonus', '30-day streak bonus!');
  }

  return newStreak;
}

/**
 * Increment a specific stat counter on user_rewards
 */
async function incrementStat(userId, statField, amount = 1) {
  const rewards = await getOrCreateRewards(userId);
  const currentVal = rewards[statField] || 0;
  await supabase
    .from('user_rewards')
    .update({
      [statField]: currentVal + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

/**
 * Process a report submission — award credits + update stats + streak
 */
async function onReportSubmitted(userId, reportId, isVerified = false) {
  if (!userId) return;

  await updateStreak(userId);

  const baseCredits = isVerified ? CREDITS.REPORT_VERIFIED : CREDITS.REPORT_SUBMITTED;
  await awardCredits(userId, baseCredits, isVerified ? 'report_verified' : 'report_submitted',
    isVerified ? 'Verified safety report' : 'Safety report submitted', reportId);

  await incrementStat(userId, 'reports_submitted');
  if (isVerified) await incrementStat(userId, 'reports_verified');

  // Update challenge progress
  await updateChallengeProgress(userId, 'submit_reports');

  // Check if report is within an adopted zone
  await checkZoneReport(userId, reportId);
}

/**
 * Process an upvote on a report — award credits to the report author
 */
async function onReportUpvoted(reportAuthorId, reportId) {
  if (!reportAuthorId) return;
  await awardCredits(reportAuthorId, CREDITS.REPORT_UPVOTED, 'report_upvoted',
    'Your report was upvoted!', reportId);
  await incrementStat(reportAuthorId, 'reports_upvoted');
  await updateChallengeProgress(reportAuthorId, 'upvote_reports');
}

/**
 * Process referral signup
 */
async function onReferralSignup(referrerId, newUserId) {
  if (!referrerId) return;
  await awardCredits(referrerId, CREDITS.REFERRAL_SIGNUP, 'referral_bonus',
    'Someone joined using your referral!', newUserId);
  await supabase
    .from('user_rewards')
    .update({
      referral_count: supabase.rpc ? undefined : 0, // will be incremented below
    })
    .eq('user_id', referrerId);

  // Increment referral count
  const { data } = await supabase.from('user_rewards').select('referral_count').eq('user_id', referrerId).single();
  if (data) {
    await supabase.from('user_rewards').update({
      referral_count: (data.referral_count || 0) + 1,
    }).eq('user_id', referrerId);
  }

  // Set referred_by on new user
  await getOrCreateRewards(newUserId);
  await supabase.from('user_rewards').update({ referred_by: referrerId }).eq('user_id', newUserId);
}

/**
 * Update challenge progress
 */
async function updateChallengeProgress(userId, challengeType) {
  const today = new Date().toISOString().split('T')[0];

  // Get active challenges matching this type
  const { data: challenges } = await supabase
    .from('weekly_challenges')
    .select('*')
    .eq('challenge_type', challengeType)
    .eq('is_active', true)
    .lte('week_start', today)
    .gte('week_end', today);

  if (!challenges || challenges.length === 0) return;

  for (const challenge of challenges) {
    // Get or create progress
    let { data: progress } = await supabase
      .from('user_challenge_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('challenge_id', challenge.id)
      .single();

    if (!progress) {
      const { data: created } = await supabase
        .from('user_challenge_progress')
        .insert({ user_id: userId, challenge_id: challenge.id, current_count: 0 })
        .select()
        .single();
      progress = created;
    }

    if (progress && !progress.completed) {
      const newCount = (progress.current_count || 0) + 1;
      const completed = newCount >= challenge.target_count;

      await supabase
        .from('user_challenge_progress')
        .update({
          current_count: newCount,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', progress.id);

      if (completed) {
        await awardCredits(userId, challenge.reward_credits, 'weekly_challenge',
          `Challenge completed: ${challenge.title}`, challenge.id);
      }
    }
  }
}

/**
 * Check if a report falls within an adopted zone
 */
async function checkZoneReport(userId, reportId) {
  const { data: report } = await supabase
    .from('safety_reports')
    .select('latitude, longitude')
    .eq('id', reportId)
    .single();

  if (!report) return;

  // Find any adopted zones this report falls into
  const { data: zones } = await supabase
    .from('zone_adoptions')
    .select('*')
    .eq('is_active', true);

  if (!zones) return;

  for (const zone of zones) {
    const dist = haversineM(report.latitude, report.longitude, zone.center_latitude, zone.center_longitude);
    if (dist <= (zone.radius_meters || 500)) {
      await supabase
        .from('zone_adoptions')
        .update({
          reports_this_month: (zone.reports_this_month || 0) + 1,
          total_reports: (zone.total_reports || 0) + 1,
          last_report_at: new Date().toISOString(),
        })
        .eq('id', zone.id);

      // If zone owner submitted the report, give bonus
      if (zone.user_id === userId) {
        // Check if earned monthly bonus (5+ reports in their zone)
        if ((zone.reports_this_month || 0) + 1 === 5 && !zone.badge_earned) {
          await awardCredits(userId, CREDITS.ZONE_MONTHLY_BONUS, 'zone_adoption_bonus',
            `Zone keeper bonus: ${zone.zone_name}`);
          await supabase.from('zone_adoptions').update({ badge_earned: true }).eq('id', zone.id);
        }
      }
    }
  }
}

/**
 * Calculate impact stats for a user
 */
async function calculateImpact(userId) {
  const rewards = await getOrCreateRewards(userId);

  // Count how many people viewed heatmap in areas where this user reported
  // Simplified: estimate based on report count * average views
  const estimatedPeopleHelped = (rewards.reports_submitted || 0) * 12;

  // Count verified reports
  const { count: verifiedCount } = await supabase
    .from('safety_reports')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('verified', true);

  // Count total upvotes on user's reports
  const { data: userReports } = await supabase
    .from('safety_reports')
    .select('upvotes')
    .eq('user_id', userId);

  const totalUpvotes = (userReports || []).reduce((sum, r) => sum + (r.upvotes || 0), 0);

  // Update cached stats
  await supabase.from('user_rewards').update({
    people_helped: estimatedPeopleHelped,
    reports_verified: verifiedCount || 0,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);

  return {
    reportsSubmitted: rewards.reports_submitted || 0,
    reportsVerified: verifiedCount || 0,
    totalUpvotes,
    peopleHelped: estimatedPeopleHelped,
    bountiesCompleted: rewards.bounties_completed || 0,
    referralCount: rewards.referral_count || 0,
  };
}

/**
 * Generate bounties for areas with stale data
 */
async function generateBounties() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Find areas that had reports > 30 days ago but nothing recent
  const { data: oldReports } = await supabase
    .from('safety_reports')
    .select('latitude, longitude, category')
    .lt('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!oldReports || oldReports.length === 0) return [];

  const bounties = [];
  const processed = new Set();

  for (const report of oldReports) {
    // Round to ~500m grid to avoid duplicate bounties
    const gridKey = `${(report.latitude * 200).toFixed(0)}_${(report.longitude * 200).toFixed(0)}`;
    if (processed.has(gridKey)) continue;
    processed.add(gridKey);

    // Check if there's a recent report nearby
    const { data: recentNearby } = await supabase
      .from('safety_reports')
      .select('id')
      .gte('created_at', thirtyDaysAgo)
      .limit(1);

    // Check no open bounty exists nearby
    const { data: existingBounty } = await supabase
      .from('verification_bounties')
      .select('id')
      .eq('status', 'open')
      .limit(1);

    if ((!recentNearby || recentNearby.length === 0) && (!existingBounty || existingBounty.length < 20)) {
      const bounty = {
        latitude: report.latitude,
        longitude: report.longitude,
        location: `POINT(${report.longitude} ${report.latitude})`,
        description: `This area was previously flagged for "${report.category}" but has no recent updates. Help keep the community safe by submitting a fresh report.`,
        reward_credits: 100,
        status: 'open',
        reason: 'stale_data',
        time_window: 'any',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const { data: created } = await supabase
        .from('verification_bounties')
        .insert(bounty)
        .select()
        .single();

      if (created) bounties.push(created);
    }

    if (bounties.length >= 5) break; // max 5 bounties per run
  }

  return bounties;
}

// ============================================================
// HELPERS
// ============================================================

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SS-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = {
  CREDITS,
  TIERS,
  TIER_ORDER,
  setIO,
  getOrCreateRewards,
  awardCredits,
  checkTierPromotion,
  updateStreak,
  incrementStat,
  onReportSubmitted,
  onReportUpvoted,
  onReferralSignup,
  updateChallengeProgress,
  checkZoneReport,
  calculateImpact,
  generateBounties,
  generateReferralCode,
};
