import posthog from 'posthog-js';

posthog.init('phc_43R1XO7sAd3wPf4HqwIPzISqj952ppJPitblyLBs81S', {
  api_host: 'https://us.i.posthog.com',
  persistence: 'localStorage',
  person_profiles: 'identified_only',
});

export default posthog;
