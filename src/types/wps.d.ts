import type { IWebOfficeSDK } from '../../public/wps/index';

declare global {
  interface Window {
    WebOfficeSDK: IWebOfficeSDK;
  }
}

export {};
