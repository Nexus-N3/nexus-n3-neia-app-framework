export const isCompactFlowViewport = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const { innerWidth, innerHeight } = window;

  return innerWidth <= 800 && innerHeight <= 400;
};
