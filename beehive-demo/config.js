// Beehive configuration.
// The publishable key is designed to be public: row-level security in the database
// decides what each signed-in person can see. Never put the service_role / secret key here.
window.BEEHIVE_CONFIG = {
  supabaseUrl: "https://gaxkvceirdxqfpeeskwf.supabase.co",
  supabaseKey: "sb_publishable_X1bMxONpsKg5Oz0vuHJ6tw_av4VKfE8",

  // Copilot Studio → your agent → Channels → Mobile app (or Web app) → "Token endpoint".
  // Requires Settings → Security → Authentication → "No authentication".
  // Leave empty to use the built-in assistant instead.
  copilotTokenEndpoint: "",
};
