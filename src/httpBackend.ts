'use strict';
import { IProvider } from './injector';

export class $HttpBackendProvider implements IProvider {
  public $get() {
    return new $HttpBackendService();
  }
}

export class $HttpBackendService {
  public request(
    method: string,
    url: string,
    body: any,
    cb: (statusCode: number, response: any, statusText: string) => any) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.send(body || null);

    xhr.onload = () => {
      const response = ('response' in xhr)
        ? xhr.response
        : xhr.responseText;

      const statusText = xhr.statusText || '';

      cb(xhr.status, response, statusText);
    };
  }
}
