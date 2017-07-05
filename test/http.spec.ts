'use strict';
import { $HttpService, $HttpProvider } from '../src/http';
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

    it('rejects promise when XHR result errors/aborts', () => {
      let receivedResponse: any;

      $http.request({
        method: 'GET',
        url: 'http://example.com'
      })
        .catch((error) => {
          receivedResponse = error;
        });

      requests[0].onerror();

      expect(receivedResponse).toBeDefined();
      expect(receivedResponse.status).toBe(0);
      expect(receivedResponse.data).toBe(null);
      expect(receivedResponse.config.url).toEqual('http://example.com');
    });

    it('uses GET method by default', () => {
      $http.request({
        url: 'http://example.com'
      });

      expect(requests.length).toBe(1);
      expect(requests[0].method).toBe('GET');
    });

    it('sets headers on request', () => {
      $http.request({
        url: 'http://example.com',
        headers: {
          'Accept': 'text/plain',
          'Cache-Control': 'no-cache'
        }
      });

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders.Accept).toBe('text/plain');
      expect(requests[0].requestHeaders['Cache-Control']).toBe('no-cache');
    });

    it('sets default headers on request', () => {
      $http.request({
        url: 'http://example.com'
      });

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders.Accept).toBe('application/json, text/plain, */*');
    });

    it('sets method-specific default headers on request', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: '42'
      });

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['Content-Type'])
        .toBe('application/json;charset=utf-8');
    });

    it('exposes default headers for overriding', () => {
      $http.defaults.headers.post['Content-Type'] = 'text/plain;charset=utf-8';

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: '42'
      });

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['Content-Type'])
        .toBe('text/plain;charset=utf-8');
    });

    it('exposes default headers through provider', () => {
      const injector = createInjector(['ng', function($httpProvider: $HttpProvider) {
        $httpProvider.defaults.headers.post['Content-Type']
          = 'text/plain;charset=utf-8'
      }]);

      const $http: $HttpService = injector.get('$http');

      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: '42'
      });

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['Content-Type'])
        .toBe('text/plain;charset=utf-8');
    });

    it('merges default headers case-insensitively', () => {
      $http.request({
        method: 'POST',
        url: 'http://example.com',
        data: 42,
        headers: {
          'content-type': 'text/plain;charset=utf-8'
        }
      });

      expect(requests.length).toBe(1);
      expect(requests[0].requestHeaders['content-type'])
        .toBe('text/plain;charset=utf-8');
      expect(requests[0].requestHeaders['Content-Type']).toBeUndefined();
    });
  });
});
