const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env variable: NEXT_PUBLIC_SUPABASE_URL. Please set it in your local .env file.");
}

if (!supabaseAnonKey) {
  throw new Error("Missing env variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. Please set it in your local .env file.");
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
} as const;
