import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// The anon/public key is designed to be embedded in client apps — every
// permission it grants is enforced by the Row Level Security policies in
// supabase/migrations/0001_init.sql, not by keeping this key secret. Never
// put the service_role key here; that one bypasses RLS entirely.
const SUPABASE_URL = 'https://bgjotqmnfnnngqsehysb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnam90cW1uZm5ubmdxc2VoeXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MDA2OTcsImV4cCI6MjEwNDI3NjY5N30.mbQwS3_jE76ChcFRGKOwlKFK3sNpBisDVb47fuwm6PI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
