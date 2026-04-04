/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SANDBOX?: string;
  readonly VITE_SANDBOX_CONFIG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
