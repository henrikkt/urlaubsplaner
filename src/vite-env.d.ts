/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** "server" = Express-API (lokal), "browser" = IndexedDB (GitHub Pages) */
  readonly VITE_STORAGE_MODE: 'server' | 'browser';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
