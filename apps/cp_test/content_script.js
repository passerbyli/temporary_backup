// content_script.js
(function () {
  // Inject the in-page script so it runs in page context and can override window.fetch / XHR
  const injected = document.createElement('script');
  injected.src = chrome.runtime.getURL('inpage_hook.js');
  injected.onload = () => injected.remove();
  (document.head || document.documentElement).appendChild(injected);

  // Listen for messages from inpage script
  window.addEventListener(
    'message',
    function (event) {
      if (!event.source) return;
      const data = event.data;
      if (!data || data.source !== 'AuthInspector_inpage') return;
      // data.payload: { url, method, headers, body, timestamp, initiator }
      chrome.runtime.sendMessage({ type: 'cap_request', payload: data.payload }, (resp) => {
        // optional: handle ack
      });
    },
    false,
  );
})();
