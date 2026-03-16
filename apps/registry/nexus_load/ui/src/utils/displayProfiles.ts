export const isCompactFlowViewport = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const { innerWidth, innerHeight } = window;

  return (
    (innerWidth <= 800 && innerHeight <= 400) ||
    (innerWidth === 1920 && innerHeight === 1080) ||
    (innerWidth === 1080 && innerHeight === 1920)
  );
};
