// Temporary module stubs — removed Amplify packages are replaced step by step.
// Delete this file after Step 2 (auth) and Step 7/8 (frontend) are complete.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'aws-amplify' {
  export const Amplify: { configure: (cfg: any) => void }
  export type ResourcesConfig = any
}
declare module 'aws-amplify/auth' {
  export function fetchAuthSession(): Promise<any>
  export function getCurrentUser(): Promise<any>
  export function signOut(): Promise<void>
}
declare module 'aws-amplify/storage' {
  export function list(opts: any): Promise<any>
  export function uploadData(opts: any): { result: Promise<any>; state: any }
  export function downloadData(opts: any): { result: Promise<any> }
  export function getUrl(opts: any): Promise<{ url: URL }>
  export function remove(opts: any): Promise<any>
}
declare module '@aws-amplify/ui-react' {
  import type { ReactNode, ComponentType } from 'react'
  export const Authenticator: ComponentType<{
    children?: ReactNode | ((props: any) => ReactNode)
  }>
  export function useAuthenticator(sel?: (ctx: any) => any): any
  export function withAuthenticator(component: ComponentType<any>): ComponentType<any>
}
declare module '@aws-amplify/ui-react-storage' {
  export const StorageBrowser: any
}
