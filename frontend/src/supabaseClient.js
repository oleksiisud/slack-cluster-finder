import { createClient } from "@supabase/supabase-js";

const projectURL = import.meta.env.VITE_PROJECT_REF;
const anonToken = import.meta.env.VITE_SUPABASE_ANON;

export const supabase = createClient(projectURL, anonToken);