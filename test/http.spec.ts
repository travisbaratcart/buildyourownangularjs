'use strict';
import { $HttpService } from '../src/http';
import { publishExternalAPI } from '../src/angularPublic';
import { createInjector } from '../src/injector';
import * as sinon from 'sinon';

describe('$http', () => {
  let $http: $HttpService;
  let xhr: sinon.SinonFakeXMLHttpRequest;
  let requests: sinon.SinonFakeXMLHttpRequest[];

  beforeEach(() => {
    publishExternalAPI();
    const injector = createInjector(['ng']);
    $http = injector.get('$http');
  });

  beforeEach(() => {
    xhr = sinon.useFakeXMLHttpRequest();
    requests = [];

    xhr.onCreate = (request: sinon.SinonFakeXMLHttpRequest) => {
      requests.push(request);
    };
  });

  afterEach(() => {
    xhr.restore();
  });

  describe('request', () => {
    it('returns a promise', () => {
      const result = $http.request({ url: 'http://example.com' });
      expect(result).toBeDefined();
      expect(result.then).toBeDefined();
    });

    it('makes an XMLHttpRequest to a given url', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 'hello'
      });

      expect(requests.length).toBe(1);
      expect(requests[0].method).toBe('POST');
      expect(requests[0].url).toBe('http://example.com');
      expect(requests[0].async).toBe(true);
      expect(requests[0].requestBody).toBe('hello');
    });

    it('resolves promise when XHR result is received', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .then((response: any) => receivedResponse = response);

      requests[0].respond(200, {}, 'Hello');

      expect(receivedResponse).toBeDefined();
      expect(receivedResponse.status).toBe(200);
      expect(receivedResponse.statusText).toBe('OK');
      expect(receivedResponse.data).toBe('Hello');
      expect(receivedResponse.config.url).toBe('http://example.com');
    });

    it('rejects promimse when XHR result received with error status', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .catch((error: any) => {
          receivedResponse = error;
        });

      requests[0].respond(401, {}, 'Fail');

      expect(receivedResponse).toBeDefined();
      expect(receivedResponse.status).toBe(401);
      expect(receivedResponse.statusText).toBe('Unauthorized');
      expect(receivedResponse.data).toBe('Fail');
      expect(receivedResponse.config.url).toBe('http://example.com');
    });
  });
});
