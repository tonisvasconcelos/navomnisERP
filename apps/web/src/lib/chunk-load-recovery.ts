const RELOAD_FLAG = 'navomnis-chunk-reload';

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isChunkLoadError(message: string): boolean {
  return CHUNK_ERROR.test(message);
}

/** Reload once after deploy when a lazy route chunk hash no longer exists on the CDN. */
export function registerChunkLoadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForNewDeploy();
  });
}

export function reloadForNewDeploy(): void {
  if (sessionStorage.getItem(RELOAD_FLAG)) {
    return;
  }
  sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
}

export function clearChunkReloadFlag(): void {
  sessionStorage.removeItem(RELOAD_FLAG);
}
