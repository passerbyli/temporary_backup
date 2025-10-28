// inpage_hook.js
(function () {
  try {
    const sendToExt = (payload) => {
      window.postMessage({ source: 'AuthInspector_inpage', payload }, '*');
    };

    // Hook fetch
    const origFetch = window.fetch;
    window.fetch = function (input, init = {}) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = (init && init.method) || 'GET';
        let body = init && init.body;
        // Try to read headers into plain object
        const headersObj = {};
        try {
          const h = init && init.headers;
          if (h instanceof Headers) {
            for (const [k, v] of h.entries()) headersObj[k] = v;
          } else if (typeof h === 'object') {
            Object.assign(headersObj, h);
          }
        } catch (e) {}

        // body summary (stringify if possible)
        let bodyText = null;
        try {
          if (typeof body === 'string') bodyText = body;
          else if (body instanceof URLSearchParams) bodyText = body.toString();
          else if (body && typeof body === 'object') {
            bodyText = JSON.stringify(body);
          }
        } catch (e) {
          bodyText = '[unserializable]';
        }

        sendToExt({
          url,
          method,
          headers: headersObj,
          body: bodyText,
          timestamp: Date.now(),
          initiator: location.origin,
        });
      } catch (e) {
        /* ignore */
      }
      return origFetch.apply(this, arguments);
    };

    // Hook XMLHttpRequest.send
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__ai_method = method;
      this.__ai_url = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        let bodyText = null;
        try {
          if (typeof body === 'string') bodyText = body;
          else if (body instanceof Document) bodyText = '[Document]';
          else if (body instanceof FormData) bodyText = '[FormData]';
          else if (body instanceof URLSearchParams) bodyText = body.toString();
          else if (body && typeof body === 'object') bodyText = JSON.stringify(body);
        } catch (e) {
          bodyText = '[unserializable]';
        }

        // collect some headers (limited)
        const headers = {};
        try {
          // cannot access request headers easily here; leave empty
        } catch (e) {}

        sendToExt({
          url: this.__ai_url || '',
          method: this.__ai_method || 'GET',
          headers,
          body: bodyText,
          timestamp: Date.now(),
          initiator: location.origin,
        });
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  } catch (e) {
    // fail silently
  }
})();
