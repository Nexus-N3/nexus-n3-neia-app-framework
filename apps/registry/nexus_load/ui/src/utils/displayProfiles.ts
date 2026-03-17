const PROFILE_STORAGE_KEY = 'nexus_display_profile';
const PROFILE_CLASS_PREFIX = 'display-profile-';

const COMPACT_PROFILES = new Set(['800x480']);

export const normalizeProfile = (raw?: string | null): string => {
  if (!raw) return '';

  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '-');
  const aliasMap: Record<string, string> = {
    '5in-portrait': '1920x1080',
    '5.5in-amoled': '1920x1080',
    'waveshare-5.5-amoled': '1920x1080',
    'waveshare-5in-800x480': '800x480',
  };

  return aliasMap[cleaned] || cleaned;
};

export const resolveDisplayProfile = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeProfile(params.get('display_profile'));
  if (fromQuery) return fromQuery;

  const fromWindow = normalizeProfile((window as Window & { __NEXUS_DISPLAY_PROFILE?: string }).__NEXUS_DISPLAY_PROFILE);
  if (fromWindow) return fromWindow;

  const fromBody = normalizeProfile(document.body?.dataset?.displayProfile);
  if (fromBody) return fromBody;

  try {
    return normalizeProfile(window.localStorage.getItem(PROFILE_STORAGE_KEY));
  } catch {
    return '';
  }
};

export const applyDisplayProfile = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const profile = resolveDisplayProfile();
  const body = document.body;
  const classesToRemove = Array.from(body.classList).filter((name) =>
    name.startsWith(PROFILE_CLASS_PREFIX),
  );
  classesToRemove.forEach((name) => body.classList.remove(name));
  body.removeAttribute('data-display-profile');

  if (!profile) {
    return;
  }

  body.classList.add(`${PROFILE_CLASS_PREFIX}${profile}`);
  body.setAttribute('data-display-profile', profile);
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, profile);
  } catch {
    // Best-effort persistence only.
  }
};

export const isCompactFlowViewport = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const profile = resolveDisplayProfile();
  if (COMPACT_PROFILES.has(profile)) {
    return true;
  }

  const { innerWidth, innerHeight } = window;
  return innerWidth <= 800 && innerHeight <= 480;
};
