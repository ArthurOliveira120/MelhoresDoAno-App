import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pskvsqwbwfyisvqtvxob.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBza3ZzcXdid2Z5aXN2cXR2eG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNTE1MjAsImV4cCI6MjA2NjcyNzUyMH0.3TFdRh4KIIwz_tSGrSjeJBvamosIv9sNyek8ZxfmA1Y";

export const supabase = createClient(supabaseUrl, supabaseKey);