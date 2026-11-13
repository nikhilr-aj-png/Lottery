/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  isEarnFlowApp?: boolean;
  isNativeApp?: boolean;
  webkitAudioContext?: typeof AudioContext;
  tronWeb?: any;
  tronLink?: any;
}
