require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Helper to create a polygon WKT from a center point and approximate radius.
 * Creates an octagonal polygon around the center.
 */
function makePolygon(centerLng, centerLat, radiusLng, radiusLat) {
  const points = [];
  const sides = 8;
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * 2 * Math.PI;
    const lng = centerLng + radiusLng * Math.cos(angle);
    const lat = centerLat + radiusLat * Math.sin(angle);
    points.push(`${lng} ${lat}`);
  }
  return `SRID=4326;POLYGON((${points.join(', ')}))`;
}

const SAFETY_ZONES = [
  // RED zones (risk_level = 10) — Dangerous areas
  {
    zone_name: 'Kalupur Station Underpass',
    risk_level: 10,
    center: [72.5650, 23.0150],
    radius: [0.003, 0.002],
    description: 'Poorly lit underpass with frequent harassment reports',
  },
  {
    zone_name: 'Sabarmati Riverside (North)',
    risk_level: 10,
    center: [72.5550, 23.0050],
    radius: [0.004, 0.0025],
    description: 'Isolated riverbank area, unsafe after dark',
  },
  {
    zone_name: 'Maninagar Industrial Zone',
    risk_level: 10,
    center: [72.5820, 23.0080],
    radius: [0.003, 0.002],
    description: 'Deserted industrial streets at night',
  },
  {
    zone_name: 'Chandkheda Outskirts',
    risk_level: 10,
    center: [72.5400, 23.0500],
    radius: [0.004, 0.003],
    description: 'Remote area with no streetlights',
  },

  // ORANGE zones (risk_level = 5) — Caution areas
  {
    zone_name: 'Navrangpura Back Lanes',
    risk_level: 5,
    center: [72.5600, 23.0300],
    radius: [0.003, 0.002],
    description: 'Narrow lanes with poor lighting at night',
  },
  {
    zone_name: 'SG Highway Service Road',
    risk_level: 5,
    center: [72.5750, 23.0350],
    radius: [0.005, 0.0015],
    description: 'Fast traffic, limited pedestrian safety at night',
  },
  {
    zone_name: 'Vastral Connector Road',
    risk_level: 5,
    center: [72.5900, 23.0250],
    radius: [0.003, 0.002],
    description: 'Occasional suspicious activity reported',
  },
  {
    zone_name: 'Ellis Bridge South',
    risk_level: 5,
    center: [72.5670, 23.0200],
    radius: [0.002, 0.0015],
    description: 'Low visibility area near bridge approach',
  },
  {
    zone_name: 'University Road (West End)',
    risk_level: 5,
    center: [72.5500, 23.0400],
    radius: [0.003, 0.002],
    description: 'Isolated stretch near university campus boundary',
  },

  // GREEN zones (risk_level = 0) — Safe areas
  {
    zone_name: 'Ahmedabad One Mall Area',
    risk_level: 0,
    center: [72.5570, 23.0280],
    radius: [0.002, 0.0015],
    description: 'Well-lit commercial zone with 24/7 security',
  },
  {
    zone_name: 'Riverfront Walk (Central)',
    risk_level: 0,
    center: [72.5650, 23.0180],
    radius: [0.004, 0.001],
    description: 'Patrolled public walkway with CCTV coverage',
  },
  {
    zone_name: 'CG Road Commercial Strip',
    risk_level: 0,
    center: [72.5680, 23.0310],
    radius: [0.004, 0.001],
    description: 'Busy commercial street, well-lit and crowded',
  },
  {
    zone_name: 'Law Garden Area',
    risk_level: 0,
    center: [72.5620, 23.0260],
    radius: [0.002, 0.0018],
    description: 'Popular public garden with evening crowd and police presence',
  },
  {
    zone_name: 'Paldi Market Zone',
    risk_level: 0,
    center: [72.5580, 23.0160],
    radius: [0.002, 0.0015],
    description: 'Active market area, safe during all hours',
  },
  {
    zone_name: 'Prahlad Nagar Commercial',
    risk_level: 0,
    center: [72.5060, 23.0130],
    radius: [0.003, 0.002],
    description: 'Modern commercial area with security infrastructure',
  },
];

async function seed() {
  console.log('Seeding safety zones...\n');

  // Clear existing zones
  const { error: delErr } = await supabase
    .from('safety_zones')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (delErr) {
    console.log('Clear error (may be fine if table is empty):', delErr.message);
  } else {
    console.log('Cleared existing safety zones');
  }

  let inserted = 0;
  for (const zone of SAFETY_ZONES) {
    const geom = makePolygon(zone.center[0], zone.center[1], zone.radius[0], zone.radius[1]);

    const { error } = await supabase.from('safety_zones').insert({
      zone_name: zone.zone_name,
      risk_level: zone.risk_level,
      geom,
      description: zone.description,
    });

    if (error) {
      console.error(`  Failed: ${zone.zone_name} — ${error.message}`);
    } else {
      const label = zone.risk_level === 10 ? 'RED' : zone.risk_level === 5 ? 'ORANGE' : 'GREEN';
      console.log(`  [${label}] ${zone.zone_name}`);
      inserted++;
    }
  }

  console.log(`\nSeeded ${inserted}/${SAFETY_ZONES.length} safety zones across Ahmedabad`);
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
