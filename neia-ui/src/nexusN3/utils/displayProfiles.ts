const PROFILE_CLASS_PREFIX = 'display-profile-';

const COMPACT_PROFILES = new Set(['800x480']);

export const normalizeProfile = (raw?: string | null): string => {
  if (!raw) return '';

  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/_/g, '-');
  const aliasMap: Record<string, string> = {
    '5in-800x480': '800x480',
    '10in-landscape': '1280x800-landscape',
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

  const { innerWidth, innerHeight } = window;
  if (innerWidth <= 800 && innerHeight <= 480) {
    return '800x480';
  }
  if (innerWidth <= 1280 && innerHeight <= 800 && innerWidth > 800) {
    return '1280x800-landscape';
  }

  return '';
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
