export const LOGIN_BACKGROUND_HORTIFRUTI = '/login/background-2.jpg';

export const LOGIN_BACKGROUND_IMAGES = [
  '/login/background-1.jpg',
  LOGIN_BACKGROUND_HORTIFRUTI,
  '/login/background-3.jpg',
  '/login/background-4.jpg',
] as const;

/** Single background for current hortifruti customer demo (no carousel). */
export const LOGIN_BACKGROUND_ACTIVE = [LOGIN_BACKGROUND_HORTIFRUTI] as const;
