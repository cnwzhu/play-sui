/// <reference types="vite/client" />

interface Window {
    env: {
        VITE_PACKAGE_ID?: string;
        VITE_PLATFORM_ADMIN_ADDRESS?: string;
        VITE_SUI_NETWORK?: string;
    }
}

interface ImportMetaEnv {
    readonly VITE_PACKAGE_ID: string
    readonly VITE_PLATFORM_ADMIN_ADDRESS: string
    readonly VITE_SUI_NETWORK: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
