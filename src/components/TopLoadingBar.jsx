import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function TopLoadingBar() {
  const location = useLocation();
  const [width, setWidth]     = useState(0);
  const [opacity, setOpacity] = useState(0);
  const intervalRef = useRef(null);
  const prevPath    = useRef(location.pathname);
  const doneRef     = useRef(true);

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;
    doneRef.current  = false;

    // Clear any previous run
    clearInterval(intervalRef.current);

    // Start bar
    setOpacity(1);
    setWidth(0);
    setTimeout(() => setWidth(18), 20);

    // Crawl slowly toward 88
    intervalRef.current = setInterval(() => {
      setWidth(w => {
        if (w >= 88) return w;
        return w + (88 - w) * 0.07;
      });
    }, 100);

    // Complete just after framer-motion page animation ends (~260ms)
    const finishTimer = setTimeout(() => {
      clearInterval(intervalRef.current);
      setWidth(100);
      setTimeout(() => { setOpacity(0); setTimeout(() => setWidth(0), 300); }, 220);
      doneRef.current = true;
    }, 700);

    return () => { clearInterval(intervalRef.current); clearTimeout(finishTimer); };
  }, [location.pathname]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 9999, pointerEvents: 'none' }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        opacity,
        background: 'linear-gradient(90deg, rgb(245,193,24), rgb(255,220,80))',
        transition: width === 0 ? 'none' : width === 100 ? 'width 0.18s ease-out' : 'width 0.35s ease',
        boxShadow: '0 0 6px rgba(245,193,24,0.45)',
        borderRadius: '0 2px 2px 0',
      }} />
    </div>
  );
}
