import posthog from 'posthog-js';

console.log('posthog api key', import.meta.env.VITE_POSTHOG_API_KEY);

posthog.init(import.meta.env.VITE_POSTHOG_API_KEY, {
  api_host: 'https://us.i.posthog.com',
  persistence: 'localStorage',
  person_profiles: 'identified_only',
  capture_pageview: false,
  disable_session_recording: true,
  autocapture: false,
  capture_performance: false,
});

export default posthog;
