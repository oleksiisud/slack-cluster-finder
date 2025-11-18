// Content script that listens for Ctrl+S on verified URLs, overriding default behavior
(function() {
  'use strict';

  // Check if current URL matches any verified URL segment
  function isVerifiedUrl() {
    const currentUrl = window.location.hostname;
    return VERIFIED_URL_SEGMENTS.some(segment => currentUrl.includes(segment));
  }

  // Listen for keyboard events
  document.addEventListener('keydown', function(event) {
    // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      // Only proceed if we're on a verified URL
      if (isVerifiedUrl()) {
        // Prevent default save behavior
        event.preventDefault();
        
        // Redirect to cluster finder (placeholder # for now)
        window.location.href = '#';
        
        console.log('Redirecting to cluster finder...');
      }
    }
  }, true); // Use capture phase to catch the event early

  console.log('Slack Cluster Finder extension loaded');
})();
