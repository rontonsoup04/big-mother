// beehive configuration.
// The publishable key is designed to be public: row-level security in the database
// decides what each signed-in person can see. Never put the service_role / secret key here.
// AI (Claude) settings live in Vercel's environment variables, never in this file.
window.BEEHIVE_CONFIG = {
  supabaseUrl: "https://gaxkvceirdxqfpeeskwf.supabase.co",
  supabaseKey: "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8",
};
