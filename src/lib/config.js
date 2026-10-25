// Supabase project for Big Mother.
// The publishable (anon) key is designed to be public: row-level security in the
// database decides what each signed-in user can see. NEVER put the service_role /
// secret key in this app.
// Override with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY in a .env file.
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://gaxkvceirdxqfpeeskwf.supabase.co";
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8";
