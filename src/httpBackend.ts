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
    cb: (statusCode: number, response: any, statusText: string) => any,
    headers: { [ headerName: string ]: string }) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    _.forEach(headers, (value, headerName) => xhr.setRequestHeader(headerName, value));

    xhr.send(body || null);

    xhr.onload = () => {
      const response = ('response' in xhr)
        ? xhr.response
        : xhr.responseText;

      const statusText = xhr.statusText || '';

      cb(xhr.status, response, statusText);
    };

    xhr.onerror = () => {
      cb(-1, null, '');
    }
  }
}
