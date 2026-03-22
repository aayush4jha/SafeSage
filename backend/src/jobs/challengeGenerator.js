const { supabase } = require('../config/db');

// Challenge templates — randomly picked and rotated
const CHALLENGE_TEMPLATES = [
  {
    title: 'Safety Scout',
    description: 'Submit 3 safety reports this week to help map danger zones.',
    challenge_type: 'submit_reports',
    target_count: 3,
    reward_credits: 50,
  },
  {
    title: 'Vigilant Reporter',
    description: 'Submit 5 safety reports with detailed descriptions.',
    challenge_type: 'submit_reports',
    target_count: 5,
    reward_credits: 80,
  },
  {
    title: 'Community Guardian',
    description: 'Submit 10 reports to become a community safety champion.',
    challenge_type: 'submit_reports',
    target_count: 10,
    reward_credits: 150,
  },
  {
    title: 'Verify & Protect',
    description: 'Submit 2 image-verified reports for higher accuracy.',
    challenge_type: 'verify_reports',
    target_count: 2,
    reward_credits: 60,
  },
  {
    title: 'Photo Investigator',
    description: 'Submit 4 reports with photo verification this week.',
    challenge_type: 'verify_reports',
    target_count: 4,
    reward_credits: 100,
  },
  {
    title: 'Community Validator',
    description: 'Upvote 5 reports you find accurate to help others.',
    challenge_type: 'upvote_reports',
    target_count: 5,
    reward_credits: 40,
  },
  {
    title: 'Report Reviewer',
    description: 'Upvote 10 safety reports to validate community data.',
    challenge_type: 'upvote_reports',
    target_count: 10,
    reward_credits: 70,
  },
  {
    title: 'Bounty Hunter',
    description: 'Complete 1 verification bounty to fill data gaps.',
    challenge_type: 'complete_bounties',
    target_count: 1,
    reward_credits: 75,
  },
  {
    title: 'Streak Warrior',
    description: 'Maintain a 5-day activity streak.',
    challenge_type: 'streak_days',
    target_count: 5,
    reward_credits: 60,
  },
  {
    title: 'Consistency Champion',
    description: 'Stay active for 7 consecutive days this week.',
    challenge_type: 'streak_days',
    target_count: 7,
    reward_credits: 100,
  },
];

/**
 * Generate weekly challenges.
 * Picks 3-4 random templates and creates them for the current week.
 * Deactivates expired challenges.
 */
async function generateChallenges() {
  try {
    const now = new Date();

    // Calculate current week boundaries (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Check if challenges already exist for this week
    const { data: existing } = await supabase
      .from('weekly_challenges')
      .select('id')
      .eq('week_start', weekStartStr)
      .eq('is_active', true);

    if (existing && existing.length >= 3) {
      console.log(`[ChallengeGenerator] ${existing.length} challenges already exist for this week. Skipping.`);
      return existing;
    }

    // Deactivate old challenges
    await supabase
      .from('weekly_challenges')
      .update({ is_active: false })
      .lt('week_end', weekStartStr);

    // Pick 4 random unique challenge types
    const shuffled = [...CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
    const selectedTypes = new Set();
    const selected = [];

    for (const tmpl of shuffled) {
      if (selected.length >= 4) break;
      if (selectedTypes.has(tmpl.challenge_type)) continue;
      selectedTypes.add(tmpl.challenge_type);
      selected.push(tmpl);
    }

    // Insert new challenges
    const toInsert = selected.map(tmpl => ({
      ...tmpl,
      week_start: weekStartStr,
      week_end: weekEndStr,
      is_active: true,
    }));

    const { data: created, error } = await supabase
      .from('weekly_challenges')
      .insert(toInsert)
      .select();

    if (error) throw error;

    console.log(`[ChallengeGenerator] Created ${created.length} new challenges for week ${weekStartStr} - ${weekEndStr}`);
    return created;
  } catch (error) {
    console.error('[ChallengeGenerator] Error:', error.message);
    return [];
  }
}

module.exports = { generateChallenges };
