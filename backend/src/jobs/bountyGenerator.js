const { supabase } = require('../config/db');

/**
 * Generate verification bounties for areas with stale or missing data.
 * Looks for report clusters that haven't been updated in 14+ days
 * and creates bounties to incentivize fresh reports.
 */
async function generateBountiesJob() {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Count existing open bounties
    const { count: openCount } = await supabase
      .from('verification_bounties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    if (openCount >= 15) {
      console.log(`[BountyGenerator] ${openCount} open bounties exist. Max 15 allowed. Skipping.`);
      return [];
    }

    // Find areas with old reports but nothing recent
    const { data: oldReports } = await supabase
      .from('safety_reports')
      .select('latitude, longitude, category, severity')
      .lt('created_at', fourteenDaysAgo)
      .order('severity', { ascending: false })
      .limit(100);

    if (!oldReports || oldReports.length === 0) {
      console.log('[BountyGenerator] No stale areas found.');
      return [];
    }

    // Get recent reports to filter out areas that are already covered
    const { data: recentReports } = await supabase
      .from('safety_reports')
      .select('latitude, longitude')
      .gte('created_at', sevenDaysAgo);

    const recentSet = new Set(
      (recentReports || []).map(r => `${(r.latitude * 100).toFixed(0)}_${(r.longitude * 100).toFixed(0)}`)
    );

    // Get existing bounty locations
    const { data: existingBounties } = await supabase
      .from('verification_bounties')
      .select('latitude, longitude')
      .in('status', ['open', 'claimed']);

    const bountySet = new Set(
      (existingBounties || []).map(b => `${(b.latitude * 100).toFixed(0)}_${(b.longitude * 100).toFixed(0)}`)
    );

    const bounties = [];
    const processed = new Set();
    const maxNew = 15 - (openCount || 0);

    const categoryDescriptions = {
      dark_road: 'poorly lit road',
      unsafe_street: 'unsafe street',
      suspicious_activity: 'suspicious activity',
      harassment: 'harassment incidents',
      no_streetlights: 'missing streetlights',
      poor_visibility: 'poor visibility',
      isolated_area: 'isolated area',
      other: 'safety concern',
    };

    for (const report of oldReports) {
      if (bounties.length >= maxNew) break;

      // Grid key (~500m cells)
      const gridKey = `${(report.latitude * 200).toFixed(0)}_${(report.longitude * 200).toFixed(0)}`;
      const coarseKey = `${(report.latitude * 100).toFixed(0)}_${(report.longitude * 100).toFixed(0)}`;

      if (processed.has(gridKey)) continue;
      if (recentSet.has(coarseKey)) continue;
      if (bountySet.has(coarseKey)) continue;
      processed.add(gridKey);

      // Determine reward based on severity
      const baseReward = 75;
      const severityBonus = ((report.severity || 3) - 1) * 15;
      const reward = baseReward + severityBonus;

      // Determine time window based on category
      const nightCategories = ['dark_road', 'no_streetlights', 'poor_visibility'];
      const timeWindow = nightCategories.includes(report.category) ? 'night' : 'any';

      const bounty = {
        latitude: report.latitude,
        longitude: report.longitude,
        location: `POINT(${report.longitude} ${report.latitude})`,
        area_name: `Area near ${report.latitude.toFixed(3)}, ${report.longitude.toFixed(3)}`,
        description: `This area was previously flagged for ${categoryDescriptions[report.category] || 'safety concerns'} but has no recent data. Visit and submit a fresh report.`,
        reward_credits: reward,
        status: 'open',
        reason: 'stale_data',
        time_window: timeWindow,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const { data: created, error } = await supabase
        .from('verification_bounties')
        .insert(bounty)
        .select()
        .single();

      if (!error && created) bounties.push(created);
    }

    // Also expire old bounties
    await supabase
      .from('verification_bounties')
      .update({ status: 'expired' })
      .eq('status', 'open')
      .lt('expires_at', new Date().toISOString());

    console.log(`[BountyGenerator] Created ${bounties.length} new bounties. Expired old ones.`);
    return bounties;
  } catch (error) {
    console.error('[BountyGenerator] Error:', error.message);
    return [];
  }
}

module.exports = { generateBountiesJob };
