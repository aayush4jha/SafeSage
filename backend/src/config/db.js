const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes('YOUR_PROJECT')) {
  console.warn('\n  WARNING: Supabase URL not configured in .env');
  console.warn('  Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env\n');
}

const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder', {
  auth: { persistSession: false }
});

async function connectDB() {
  try {
    const { data, error } = await supabase.from('safety_reports').select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log('  Tables not found — run the migration SQL in Supabase Dashboard');
      return supabase;
    }
    if (error && error.message?.includes('Invalid API key')) {
      throw new Error('Invalid Supabase API key. Check .env');
    }
    console.log('  Supabase connected successfully');
    return supabase;
  } catch (err) {
    console.error('  Supabase connection failed:', err.message);
    return supabase;
  }
}

module.exports = { supabase, connectDB };
