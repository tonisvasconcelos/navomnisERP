import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { LOGIN_BACKGROUND_IMAGES } from '../login-backgrounds';

const DEFAULT_INTERVAL_MS = 3000;
const TRANSITION_DURATION_S = 0.75;

type Props = {
  images?: readonly string[];
  intervalMs?: number;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function LoginBackgroundCarousel({
  images = LOGIN_BACKGROUND_IMAGES,
  intervalMs = DEFAULT_INTERVAL_MS,
}: Props) {
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const slides = images.length ? images : [...LOGIN_BACKGROUND_IMAGES];

  useEffect(() => {
    if (prefersReducedMotion || slides.length <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, prefersReducedMotion, slides.length]);

  const currentSrc = slides[prefersReducedMotion ? 0 : index];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {prefersReducedMotion ? (
        <img
          src={slides[0]}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      ) : (
        <AnimatePresence mode="sync">
          <motion.img
            key={currentSrc}
            src={currentSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            initial={{ opacity: 0, filter: 'blur(12px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(12px)' }}
            transition={{ duration: TRANSITION_DURATION_S, ease: 'easeInOut' }}
          />
        </AnimatePresence>
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80" />
    </div>
  );
}
