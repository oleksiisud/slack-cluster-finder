import dotenv from 'dotenv';
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectURL = process.env.PROJECT_REF;
const anonToken = process.env.SUPABASE_ANON;

export const supabase = createClient(projectURL, anonToken);