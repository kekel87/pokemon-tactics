/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SANDBOX?: string;
  readonly VITE_SANDBOX_CONFIG?: string;
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
