import { API } from '../../main/preload';

declare global {
  interface Window {
    electronAPI: typeof API;
  }
}
