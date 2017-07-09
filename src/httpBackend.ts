'use strict';
import { IProvider } from './injector';
import * as _ from 'lodash';

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
    cb: (statusCode: number, response: any, headers: string, statusText: string) => any,
    headers: { [ headerName: string ]: string },
    timeout: Promise<any>,
    withCredentials: boolean) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    _.forEach(headers, (value, headerName) => xhr.setRequestHeader(headerName, value));

    if (withCredentials) {
      xhr.withCredentials = true;
    }

    xhr.send(body || null);

    let timeoutId: number;

    if (typeof timeout === 'number') {
      timeoutId = setTimeout(() => xhr.abort(), timeout);
    } else if (timeout && timeout.then) {
      timeout.then(() => xhr.abort());
    }

    xhr.onload = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const response = ('response' in xhr)
        ? xhr.response
        : xhr.responseText;

      const statusText = xhr.statusText || '';

      cb(xhr.status, response, xhr.getAllResponseHeaders(), statusText);
    };

    xhr.onerror = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      cb(-1, null, '',  '');
    }


  }
}
