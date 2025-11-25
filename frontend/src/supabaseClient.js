import { createClient } from "@supabase/supabase-js";

const projectURL = import.meta.env.VITE_SUPABASE_URL;
const anonToken = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(projectURL, anonToken);