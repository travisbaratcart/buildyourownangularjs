'use strict';
import { IProvider } from './injector';

export class $HttpBackendProvider implements IProvider {
  public $get() {
    return new $HttpBackendService();
  }
}

export class $HttpBackendService {
  public request(method: string, url: string, body: any) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.send(body || null);
  }
}
