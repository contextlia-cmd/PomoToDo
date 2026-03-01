import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// 【重要】Supabaseの設定
// 以下のURLとAPIキーを、作成したご自身のSupabaseプロジェクトのものに書き換えてください。
// ============================================================================

const SUPABASE_URL = 'https://nuusgqdboeusnbqanhtf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dXNncWRib2V1c25icWFuaHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTA5NzMsImV4cCI6MjA4Nzg4Njk3M30.oENZBYbeH0YUPOSPOyi-2gNJC28f3e2hZZA3P5hvofo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
