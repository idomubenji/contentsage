require('dotenv').config({path: '.env.local'}); console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL, 'KEY_PREFIX:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 5));
