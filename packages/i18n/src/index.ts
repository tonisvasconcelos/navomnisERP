import ptBR from '../locales/pt-BR.json';

export const defaultLocale = 'pt-BR';

export const resources = {
  'pt-BR': { translation: ptBR },
} as const;

export type AppResources = typeof resources;
