import posthog from 'posthog-js';


const phc_key = import.meta.env.VITE_POSTHOG_API_KEY;

posthog.init(phc_key, {
  api_host: 'https://us.i.posthog.com',
  persistence: 'localStorage',
  person_profiles: 'identified_only',
  capture_pageview: false,
  disable_session_recording: true,
  autocapture: false,
  capture_performance: false,
});


const APP_VERSION = '0.1.1';

/*
** DAU
*/
function captureDailyActive() {
  try {
    const key = 'ph_last_active_day';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (localStorage.getItem(key) !== today) {
      posthog.capture('app_active_daily', {
        app_version: APP_VERSION,
      });
      localStorage.setItem(key, today);
    }
  } catch { }
}

captureDailyActive();
window.addEventListener('focus', captureDailyActive);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') captureDailyActive();
});


export default posthog;
