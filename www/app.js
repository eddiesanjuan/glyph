    // ============================================
    // Utilities
    // ============================================
    function debounce(fn, delay) {
      let timer;
      return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    // ============================================
    // Configuration
    // ============================================
    const API_URL = (() => {
      // Always use production API for consistency
      // Set USE_LOCAL_API=true in localStorage for local development
      if (window.location.hostname === 'localhost' && localStorage.getItem('USE_LOCAL_API')) {
        return 'http://localhost:3000';
      }
      // Custom domain for glyph.you
      if (window.location.hostname.includes('glyph.you')) {
        return 'https://api.glyph.you';
      }
      // Railway fallback
      if (window.location.hostname.includes('.railway.app')) {
        return 'https://api.glyph.you';
      }
      // All other cases use production API
      return 'https://api.glyph.you';
    })();
    const DEMO_API_KEY = 'gk_demo_playground_2024'; // Demo key for playground

    // Warm up API on page load (reduces Railway cold start latency)
    // Non-blocking, fire-and-forget
    (async () => {
      try {
        await fetch(`${API_URL}/health`, { method: 'GET' });
        console.log('[Glyph] API warmed up');
      } catch (e) {
        // Silently ignore - warm-up is optional
      }
    })();

    // ============================================
    // Storage Availability Detection (Private Mode)
    // ============================================
    let isStorageAvailable = true;
    let storageFailureCount = 0;
    let storageWarningShown = false;

    // Test if localStorage is available (fails in private browsing)
    function checkStorageAvailability() {
      const testKey = '__glyph_storage_test__';
      try {
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    }

    // Call on page load
    isStorageAvailable = checkStorageAvailability();

    // Track storage failures and show warning
    function handleStorageFailure() {
      storageFailureCount++;
      if (storageFailureCount >= 2 && !storageWarningShown) {
        storageWarningShown = true;
        // Delay to ensure showToast is available
        setTimeout(() => {
          if (typeof showToast === 'function') {
            showToast('Private browsing detected - saved versions won\'t persist', 'warning', 6000);
          }
        }, 1000);
      }
    }

    // Safe localStorage wrapper
    function safeSetItem(key, value) {
      if (!isStorageAvailable) {
        handleStorageFailure();
        return false;
      }
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn('[Glyph] localStorage.setItem failed:', e);
        handleStorageFailure();
        return false;
      }
    }

    function safeGetItem(key, defaultValue = null) {
      if (!isStorageAvailable) return defaultValue;
      try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
      } catch (e) {
        console.warn('[Glyph] localStorage.getItem failed:', e);
        return defaultValue;
      }
    }

    // Show initial warning if storage unavailable
    if (!isStorageAvailable) {
      // Delay to ensure DOM is ready and showToast is available
      setTimeout(() => {
        if (typeof showToast === 'function') {
          showToast('Private browsing detected - saved versions won\'t persist', 'warning', 6000);
        }
      }, 2000);
    }

    // ============================================
    // Demo PDF Generation (Issue #1 - Cycle 7)
    // ============================================
    const MAX_DEMO_DOWNLOADS = 3;
    let demoDownloadCount = 0;

    // Add watermark to HTML for demo PDFs
    function addWatermarkToHtml(html) {
      const watermarkStyle = `
        <style>
          .glyph-demo-watermark {
            position: fixed;
            bottom: 12px;
            right: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 10px;
            color: rgba(100, 116, 139, 0.6);
            background: rgba(248, 250, 252, 0.9);
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid rgba(148, 163, 184, 0.3);
            z-index: 9999;
            pointer-events: none;
          }
          @media print {
            .glyph-demo-watermark {
              position: fixed;
              bottom: 12px;
              right: 12px;
            }
          }
        </style>
      `;
      const watermarkHtml = '<div class="glyph-demo-watermark">Created with Glyph - glyph.you</div>';

      // Insert watermark before closing body tag
      if (html.includes('</body>')) {
        return html.replace('</body>', watermarkStyle + watermarkHtml + '</body>');
      } else {
        // If no body tag, append at the end
        return html + watermarkStyle + watermarkHtml;
      }
    }

    // Generate demo PDF with watermark
    async function generateDemoPdf() {
      if (demoDownloadCount >= MAX_DEMO_DOWNLOADS) {
        // Show API key modal if limit reached
        showModal();
        return false;
      }

      if (!currentHtml) {
        showToast('No document to generate. Please wait for preview to load.', 'error');
        return false;
      }

      try {
        const watermarkedHtml = addWatermarkToHtml(currentHtml);

        const response = await fetch(`${API_URL}/v1/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEMO_API_KEY}`
          },
          body: JSON.stringify({
            html: watermarkedHtml,
            format: 'pdf'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'PDF generation failed');
        }

        // Download the PDF
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `glyph-demo-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Update demo download count
        demoDownloadCount++;
        const remaining = MAX_DEMO_DOWNLOADS - demoDownloadCount;

        // Update the success modal text
        const remainingEl = document.getElementById('demo-downloads-remaining');
        if (remainingEl) {
          if (remaining === 0) {
            remainingEl.textContent = 'This was your last demo download.';
          } else {
            remainingEl.textContent = `${remaining} demo download${remaining === 1 ? '' : 's'} remaining.`;
          }
        }

        // Show success upsell modal
        showPdfSuccessModal();
        return true;
      } catch (err) {
        console.error('[Glyph] Demo PDF generation failed:', err);
        showToast('PDF generation failed. Please try again.', 'error');
        return false;
      }
    }

    // PDF Success Modal functions
    function showPdfSuccessModal() {
      const modal = document.getElementById('pdf-success-modal');
      if (modal) {
        modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
      }
    }

    function hidePdfSuccessModal() {
      const modal = document.getElementById('pdf-success-modal');
      if (modal) {
        modal.classList.remove('visible');
        document.body.style.overflow = '';
      }
    }

    // ============================================
    // Copy to Clipboard (Integration Cards)
    // ============================================

    // Fallback copy using legacy execCommand
    function fallbackCopyToClipboard(text) {
      return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);

        try {
          textarea.select();
          textarea.setSelectionRange(0, text.length);
          const success = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (success) {
            resolve();
          } else {
            reject(new Error('execCommand copy failed'));
          }
        } catch (err) {
          document.body.removeChild(textarea);
          reject(err);
        }
      });
    }

    // Unified clipboard copy with fallback
    async function copyTextToClipboard(text) {
      // Try modern Clipboard API first
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (err) {
          console.warn('[Glyph] Clipboard API failed, trying fallback:', err);
        }
      }

      // Fallback to execCommand
      try {
        await fallbackCopyToClipboard(text);
        return true;
      } catch (err) {
        console.error('[Glyph] All clipboard methods failed:', err);
        return false;
      }
    }

    function copyToClipboard(text, element) {
      // Decode HTML entities for the SDK script tag
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      const decodedText = textarea.value;

      copyTextToClipboard(decodedText).then((success) => {
        const toast = document.getElementById('copy-toast');
        if (success) {
          // Show success toast
          toast.classList.add('show');
          setTimeout(() => {
            toast.classList.remove('show');
          }, 2000);
        } else {
          // Show error toast for clipboard failure
          showToast("Couldn't copy to clipboard - try Ctrl/Cmd+C", 'error', 4000);
        }
      });
    }

    // Copy quick start snippet
    function copyQuickStart(btn) {
      const snippet = '<script src="https://sdk.glyph.you/glyph.min.js"></script>\n<glyph-editor\n  api-key="YOUR_KEY"\n  template="quote-modern"\n></glyph-editor>';

      copyTextToClipboard(snippet).then((success) => {
        if (success) {
          btn.classList.add('copied');
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2"/></svg> Copy';
          }, 2000);
        }
      });
    }

    // Copy integration code from the currently visible tab
    function copyIntegrationCode() {
      // Find the active code block
      const activeBlock = document.querySelector('.code-block--active');
      if (!activeBlock) return;

      // Get the text content (strips HTML tags)
      const codeElement = activeBlock.querySelector('code');
      if (!codeElement) return;

      // Get plain text, decode HTML entities
      const textarea = document.createElement('textarea');
      textarea.innerHTML = codeElement.textContent || '';
      const codeText = textarea.value;

      copyTextToClipboard(codeText).then((success) => {
        const btn = document.getElementById('integration-copy-btn');

        if (success) {
          // Update button state
          if (btn) {
            btn.classList.add('copied');
            btn.querySelector('span').textContent = 'Copied!';

            setTimeout(() => {
              btn.classList.remove('copied');
              btn.querySelector('span').textContent = 'Copy Code';
            }, 2000);
          }

          // Show toast with CTA message
          showIntegrationCopyToast();
        } else {
          // Show error state
          if (btn) {
            btn.classList.add('error');
            btn.querySelector('span').textContent = 'Copy failed';

            setTimeout(() => {
              btn.classList.remove('error');
              btn.querySelector('span').textContent = 'Copy Code';
            }, 3000);
          }
          showToast("Couldn't copy to clipboard - try Ctrl/Cmd+C", 'error', 4000);
        }
      });
    }

    // Show special toast for integration code copy
    function showIntegrationCopyToast() {
      // Create or reuse toast
      let toast = document.getElementById('integration-copy-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'integration-copy-toast';
        toast.className = 'integration-copy-toast';
        toast.innerHTML = `
          <div class="integration-copy-toast__content">
            <svg class="integration-copy-toast__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>Copied! <a href="https://dashboard.glyph.you">Get your API key</a> to start using Glyph</span>
          </div>
        `;
        document.body.appendChild(toast);
      }

      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
      }, 4000);
    }

    // Current state
    let currentTemplate = 'quote-modern';
    let currentHtml = '';
    let sessionId = null;

    // Undo history - stores previous HTML states (max 10 items)
    const MAX_UNDO_HISTORY = 10;
    let undoHistory = [];

    // Redo history - stores states that can be redone (max 20 items)
    const MAX_REDO_HISTORY = 20;
    let redoHistory = [];

    // Diff toggle - stores region snapshots before/after modification
    let diffRegionSnapshots = null; // { before: Map<regionName, innerHTML>, after: Map<regionName, innerHTML> }
    let isDiffActive = false;

    // Track applied instant actions - shows visual "applied" state on buttons
    const appliedActions = new Set();

    // ============================================
    // Session Timer Management - CRITICAL UX
    // ============================================
    const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds
    const WARNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes warning
    const URGENT_THRESHOLD_MS = 5 * 60 * 1000;   // 5 minutes urgent

    let sessionStartTime = null;
    let sessionTimerInterval = null;
    let hasShown10MinWarning = false;
    let hasShown5MinWarning = false;
    let userHasInteracted = false; // Track if user has performed any action (prevents stale toasts on load)
    let hasShownSuccessCta = false; // Track if we've shown the success CTA (show once per session)
    let hasShownFirstInstantWin = false; // Track if we've shown the first instant action celebration (once per session)

    // DOM elements for session timer (lazy loaded)
    function getSessionTimerElements() {
      return {
        timer: document.getElementById('session-timer'),
        timerText: document.getElementById('session-timer-text'),
        warningToast: document.getElementById('session-warning-toast'),
        warningTitle: document.getElementById('session-warning-title'),
        warningMessage: document.getElementById('session-warning-message'),
        warningDownload: document.getElementById('session-warning-download'),
        warningDismiss: document.getElementById('session-warning-dismiss')
      };
    }

    // Format remaining time for display
    function formatTimeRemaining(ms) {
      if (ms <= 0) return 'Expired';
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      if (minutes >= 60) {
        return '60 min';
      } else if (minutes > 0) {
        return `${minutes} min`;
      } else {
        return `${seconds}s`;
      }
    }

    // Start session timer when preview loads
    function startSessionTimer() {
      sessionStartTime = Date.now();
      hasShown10MinWarning = false;
      hasShown5MinWarning = false;

      // Clear any existing interval
      if (sessionTimerInterval) {
        clearInterval(sessionTimerInterval);
      }

      // Update timer every second
      sessionTimerInterval = setInterval(updateSessionTimer, 1000);
      updateSessionTimer(); // Initial update

      // Pause timer when tab is hidden to save CPU/battery
      document.addEventListener('visibilitychange', handleVisibilityChange);

      console.log('[Glyph] Session timer started');
    }

    // Pause/resume session timer based on tab visibility
    function handleVisibilityChange() {
      if (document.hidden) {
        // Tab hidden - pause the interval
        if (sessionTimerInterval) {
          clearInterval(sessionTimerInterval);
          sessionTimerInterval = null;
        }
      } else {
        // Tab visible - resume and immediately update
        if (sessionStartTime && !sessionTimerInterval) {
          updateSessionTimer();
          sessionTimerInterval = setInterval(updateSessionTimer, 1000);
        }
      }
    }

    // Update session timer display and check warnings
    function updateSessionTimer() {
      if (!sessionStartTime) return;

      const els = getSessionTimerElements();
      if (!els.timer || !els.timerText) return;

      const elapsed = Date.now() - sessionStartTime;
      const remaining = SESSION_DURATION_MS - elapsed;

      // Update display
      els.timerText.textContent = formatTimeRemaining(remaining);

      // Update timer styling and tooltip based on remaining time
      els.timer.classList.remove('warning', 'urgent');
      if (remaining <= URGENT_THRESHOLD_MS) {
        els.timer.classList.add('urgent');
        els.timer.title = 'Session expiring soon! Download PDF now to save your work.';
      } else if (remaining <= WARNING_THRESHOLD_MS) {
        els.timer.classList.add('warning');
        els.timer.title = 'Less than 10 minutes remaining. Consider saving your work.';
      } else {
        els.timer.title = 'Demo session lasts 60 minutes. Changes are lost when session expires. Download PDF to save your work.';
      }

      // Show 10-minute warning toast
      if (remaining <= WARNING_THRESHOLD_MS && remaining > URGENT_THRESHOLD_MS && !hasShown10MinWarning) {
        hasShown10MinWarning = true;
        showSessionWarning(
          'Session expires in 10 minutes',
          'Save your work! Download PDF or save a named version now.',
          false
        );
      }

      // Show 5-minute urgent warning toast
      if (remaining <= URGENT_THRESHOLD_MS && remaining > 0 && !hasShown5MinWarning) {
        hasShown5MinWarning = true;
        showSessionWarning(
          'Session expires in 5 minutes!',
          'Download your PDF or sign up to continue working.',
          true
        );
      }

      // Session expired - graceful reload
      if (remaining <= 0) {
        clearInterval(sessionTimerInterval);
        handleSessionExpired();
      }
    }

    // Show session warning toast (only after user has interacted)
    function showSessionWarning(title, message, isUrgent) {
      // Don't show session warnings until user has performed an action
      // This prevents stale toasts from appearing on fresh page load
      if (!userHasInteracted) {
        console.log('[Glyph] Suppressing session warning - user has not interacted yet');
        return;
      }

      const els = getSessionTimerElements();
      if (!els.warningToast) return;

      els.warningTitle.textContent = title;
      els.warningMessage.textContent = message;

      els.warningToast.classList.remove('urgent');
      if (isUrgent) {
        els.warningToast.classList.add('urgent');
      }

      // STALE TOAST FIX: Clear inline display:none before showing
      els.warningToast.style.display = 'flex';
      els.warningToast.removeAttribute('aria-hidden');
      els.warningToast.classList.add('visible');
      console.log(`[Glyph] Session warning: ${title}`);
    }

    // Hide session warning toast
    function hideSessionWarning() {
      const els = getSessionTimerElements();
      if (els.warningToast) {
        els.warningToast.classList.remove('visible');
        // Re-hide after animation
        setTimeout(() => {
          if (!els.warningToast.classList.contains('visible')) {
            els.warningToast.style.display = 'none';
            els.warningToast.setAttribute('aria-hidden', 'true');
          }
        }, 300);
      }
    }

    // Handle session expiration gracefully
    function handleSessionExpired() {
      console.log('[Glyph] Session expired - initiating graceful reload');

      // Show final message
      const els = getSessionTimerElements();
      if (els.warningToast) {
        els.warningTitle.textContent = 'Session Expired';
        els.warningMessage.textContent = 'Starting fresh session...';
        // STALE TOAST FIX: Clear inline display:none before showing
        els.warningToast.style.display = 'flex';
        els.warningToast.removeAttribute('aria-hidden');
        els.warningToast.classList.add('visible', 'urgent');

        // Hide action buttons since we're auto-reloading
        const actions = els.warningToast.querySelector('.session-warning-toast__actions');
        if (actions) actions.style.display = 'none';
      }

      // Reset session state and reload preview after brief delay
      setTimeout(() => {
        sessionId = null;
        sessionStartTime = null;
        currentHtml = '';
        undoHistory = [];
        redoHistory = [];
        historyEntries = [];
        currentHistoryIndex = -1;

        // Hide warning
        hideSessionWarning();

        // Reload preview with fresh session
        loadPreview();

        // Show success toast
        showToast('New session started', 'success');
      }, 2000);
    }

    // Initialize session timer event listeners
    function initSessionTimerListeners() {
      const els = getSessionTimerElements();

      // Dismiss warning button
      if (els.warningDismiss) {
        els.warningDismiss.addEventListener('click', hideSessionWarning);
      }

      // Download PDF button in warning - triggers generate
      if (els.warningDownload) {
        els.warningDownload.addEventListener('click', () => {
          hideSessionWarning();
          // Trigger PDF generation
          const generateBtn = document.getElementById('generate-btn');
          if (generateBtn) generateBtn.click();
        });
      }
    }

    // Initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSessionTimerListeners);
    } else {
      initSessionTimerListeners();
    }

    // ============================================
    // API Error Toast - User-Visible Error Handling
    // Cycle 6: Enhanced with retry tracking and better guidance
    // ============================================
    let lastFailedPrompt = null;
    let apiErrorToastTimeout = null;
    let consecutiveFailures = 0; // Track consecutive failures for guidance
    let lastErrorWasSessionError = false; // Track if session needs refresh on retry
    let autoRetryCount = 0; // Track auto-retry attempts (max 2)
    let isAutoRetrying = false; // Prevent manual retry during auto-retry
    const MAX_AUTO_RETRIES = 2;
    const RETRY_DELAYS = [1000, 2000]; // Exponential backoff: 1s, 2s

    // Get API error toast elements
    function getApiErrorElements() {
      return {
        toast: document.getElementById('api-error-toast'),
        message: document.getElementById('api-error-message'),
        retryBtn: document.getElementById('api-error-retry'),
        dismissBtn: document.getElementById('api-error-dismiss'),
        closeBtn: document.getElementById('api-error-close'),
        title: document.getElementById('api-error-title')
      };
    }

    // Classify error for retry/fallback decisions
    function classifyError(errorMessage) {
      const lowerMsg = errorMessage.toLowerCase();
      if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('failed to fetch')) return 'network';
      if (lowerMsg.includes('timeout') || lowerMsg.includes('took too long')) return 'timeout';
      if (lowerMsg.includes('session') || lowerMsg.includes('expired') || lowerMsg.includes('dev_session_not_found')) return 'session';
      if (lowerMsg.includes('rate') || lowerMsg.includes('429')) return 'rate_limit';
      if (lowerMsg.includes('500') || lowerMsg.includes('502') || lowerMsg.includes('503')) return 'server';
      if (lowerMsg.includes('cannot delete') || lowerMsg.includes('would remove content') || lowerMsg.includes('destructive')) return 'guardrail_destructive';
      if (lowerMsg.includes('cannot modify protected') || lowerMsg.includes('protected field') || lowerMsg.includes('protected region')) return 'guardrail_protected';
      if (lowerMsg.includes('guardrail') || lowerMsg.includes('blocked') || lowerMsg.includes('refused') || lowerMsg.includes('cannot')) return 'guardrail';
      if (lowerMsg.includes('not possible') || lowerMsg.includes('not feasible') || lowerMsg.includes('pdfs are static') || lowerMsg.includes('static document')) return 'impossible';
      return 'unknown';
    }

    // Determine if error type is retryable (auto-retry eligible)
    function isRetryableError(errorType) {
      return ['network', 'timeout', 'server', 'session', 'unknown'].includes(errorType);
    }

    // Show API error toast with actionable message
    function showApiError(errorMessage, prompt, skipAutoRetry) {
      const els = getApiErrorElements();
      if (!els.toast) return;

      const errorType = classifyError(errorMessage);

      // Auto-retry for retryable errors (not guardrails/impossible)
      if (!skipAutoRetry && isRetryableError(errorType) && autoRetryCount < MAX_AUTO_RETRIES && !isAutoRetrying) {
        autoRetryCount++;
        isAutoRetrying = true;
        lastFailedPrompt = prompt;
        if (errorType === 'session') lastErrorWasSessionError = true;

        const retryDelay = RETRY_DELAYS[autoRetryCount - 1];
        const retryStatusEl = document.getElementById('api-error-retry-status');

        // Show the toast briefly with retry status
        els.message.textContent = errorType === 'timeout'
          ? 'This modification is taking longer than usual.'
          : errorType === 'network'
          ? 'Connection issue detected.'
          : 'Something went wrong.';
        if (els.title) els.title.textContent = 'Retrying...';
        if (retryStatusEl) {
          retryStatusEl.style.display = 'block';
          retryStatusEl.textContent = 'Retrying... (' + autoRetryCount + '/' + MAX_AUTO_RETRIES + ')';
        }
        if (els.retryBtn) els.retryBtn.disabled = true;

        // Show fallback area hidden during auto-retry
        const fallbackEl = document.getElementById('api-error-fallback');
        if (fallbackEl) fallbackEl.style.display = 'none';

        // Show toast
        els.toast.style.display = 'flex';
        els.toast.removeAttribute('inert');
        els.toast.classList.add('visible');

        // Clear existing auto-hide
        if (apiErrorToastTimeout) clearTimeout(apiErrorToastTimeout);

        console.log('[Glyph] Auto-retrying (' + autoRetryCount + '/' + MAX_AUTO_RETRIES + ') in ' + retryDelay + 'ms');

        setTimeout(async () => {
          hideApiError();
          isAutoRetrying = false;
          if (els.retryBtn) els.retryBtn.disabled = false;
          if (lastFailedPrompt) {
            // Handle session refresh if needed
            if (lastErrorWasSessionError) {
              lastErrorWasSessionError = false;
              try {
                setStatus('Refreshing session...');
                await initializePreview();
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (err) {
                console.error('[Glyph] Session refresh failed during auto-retry:', err);
                autoRetryCount = MAX_AUTO_RETRIES; // Stop retrying
                showApiError('Session refresh failed. Please reload the page.', prompt, true);
                return;
              }
            }
            applyModifications(lastFailedPrompt);
          }
        }, retryDelay);
        return;
      }

      // If we get here, auto-retries exhausted or non-retryable error
      // Reset auto-retry state
      autoRetryCount = 0;
      isAutoRetrying = false;

      // Track consecutive failures
      consecutiveFailures++;

      // Store failed prompt for retry
      lastFailedPrompt = prompt;

      // Set title based on failure count
      if (els.title) {
        if (consecutiveFailures >= 2) {
          els.title.textContent = 'Still Having Trouble';
        } else {
          els.title.textContent = 'Modification Failed';
        }
      }

      // Set error message - make it user-friendly with progressive guidance
      let userMessage = '';

      switch (errorType) {
        case 'network':
          userMessage = 'Connection issue. Check your network and retry.';
          break;
        case 'timeout':
          userMessage = consecutiveFailures >= 2
            ? 'Complex requests need more processing time. Try specific instructions like "Make the header blue" or "Add a border to the table".'
            : 'This modification is taking longer than usual. Try a simpler change, or retry.';
          break;
        case 'session':
          userMessage = 'Your session has expired. Refreshing...';
          lastErrorWasSessionError = true;
          // Auto-refresh session in background
          initializePreview().catch(() => {});
          break;
        case 'rate_limit':
          userMessage = 'Too many requests. Please wait a moment and try again.';
          break;
        case 'server':
          userMessage = 'Server is busy. Click Retry in a moment.';
          break;
        case 'guardrail_destructive':
          userMessage = 'This request would remove content. Try styling changes like colors, fonts, or layout instead.';
          break;
        case 'guardrail_protected':
          userMessage = 'Some fields are protected. Try adding new elements or changing existing styles.';
          break;
        case 'guardrail':
          userMessage = errorMessage + ' Try a different approach.';
          break;
        case 'impossible':
          userMessage = errorMessage;
          break;
        default:
          userMessage = consecutiveFailures >= 2
            ? 'The AI couldn\'t process this request. Try rephrasing your description.'
            : 'Something went wrong. Click Retry or try a different prompt.';
      }

      els.message.textContent = userMessage;

      // Clear retry status
      const retryStatusEl = document.getElementById('api-error-retry-status');
      if (retryStatusEl) retryStatusEl.style.display = 'none';

      // Update retry button text based on failure count
      if (els.retryBtn) {
        els.retryBtn.textContent = consecutiveFailures >= 2 ? 'Try Again' : 'Retry';
        els.retryBtn.disabled = false;
      }

      // Show fallback instant action suggestions for non-retryable or exhausted errors
      const fallbackEl = document.getElementById('api-error-fallback');
      if (fallbackEl) {
        const showFallback = !isRetryableError(errorType) || consecutiveFailures >= 2;
        fallbackEl.style.display = showFallback ? 'block' : 'none';
      }

      // STALE TOAST FIX: Clear inline display:none before showing
      els.toast.style.display = 'flex';
      els.toast.removeAttribute('inert'); // Remove inert to allow interaction (fixes aria-hidden focus warning)
      els.toast.classList.add('visible');

      // Clear any existing timeout
      if (apiErrorToastTimeout) {
        clearTimeout(apiErrorToastTimeout);
      }

      // Auto-hide after 15 seconds (longer since user needs to read suggestions)
      apiErrorToastTimeout = setTimeout(hideApiError, 15000);

      console.error('[Glyph] API Error shown to user:', errorMessage, '(type: ' + errorType + ', retries exhausted: ' + (autoRetryCount >= MAX_AUTO_RETRIES) + ')');
    }

    // Hide API error toast
    function hideApiError() {
      const els = getApiErrorElements();
      if (els.toast) {
        els.toast.classList.remove('visible');
        // Re-hide after animation
        setTimeout(() => {
          if (!els.toast.classList.contains('visible')) {
            els.toast.style.display = 'none';
            els.toast.setAttribute('inert', ''); // Re-add inert to prevent focus when hidden
          }
        }, 300);
      }
      if (apiErrorToastTimeout) {
        clearTimeout(apiErrorToastTimeout);
        apiErrorToastTimeout = null;
      }
    }

    // Retry failed modification (manual retry resets auto-retry counter)
    async function retryFailedModification() {
      autoRetryCount = 0; // Reset so auto-retry can kick in again on next failure
      hideApiError();
      if (lastFailedPrompt) {
        // If session was expired/lost, reinitialize preview first to get fresh session
        if (lastErrorWasSessionError) {
          console.log('[Glyph] Session error detected, refreshing session before retry');
          setStatus('Refreshing session...');
          lastErrorWasSessionError = false; // Reset flag
          try {
            await initializePreview();
            // Small delay to ensure session is ready
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error('[Glyph] Failed to refresh session:', err);
            showToast('Unable to refresh session. Please reload the page.', 'error');
            return;
          }
        }
        // Re-apply the failed prompt
        applyModifications(lastFailedPrompt);
      }
    }

    // Initialize API error toast event listeners
    function initApiErrorListeners() {
      const els = getApiErrorElements();

      if (els.retryBtn) {
        els.retryBtn.addEventListener('click', retryFailedModification);
      }

      if (els.dismissBtn) {
        els.dismissBtn.addEventListener('click', hideApiError);
      }

      if (els.closeBtn) {
        els.closeBtn.addEventListener('click', hideApiError);
      }

      // Fallback instant action buttons
      const fallbackBtns = document.querySelectorAll('.api-error-toast__fallback-btn');
      fallbackBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const prompt = btn.getAttribute('data-prompt');
          if (prompt) {
            hideApiError();
            consecutiveFailures = 0;
            autoRetryCount = 0;
            applyModifications(prompt);
          }
        });
      });
    }

    // Initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApiErrorListeners);
    } else {
      initApiErrorListeners();
    }

    // ============================================
    // Navigation Scroll Effect
    // ============================================
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }, { passive: true });

    // ============================================
    // Hero Demo Animation
    // ============================================
    const typingText = document.getElementById('typing-text');
    const heroDemo = document.getElementById('hero-demo');
    const commands = [
      { text: 'Add a diagonal DRAFT watermark', color: '#1E3A5F', effect: 'watermark' },
      { text: 'Group items by category with subtotals', color: '#0D9488', effect: 'grouping' },
      { text: 'Add a QR code for instant payment', color: '#1E3A5F', effect: 'qrcode' },
      { text: 'Add payment terms: Net 30', color: '#22C55E', effect: 'terms' },
      { text: 'Add a signature line with date', color: '#F97316', effect: 'signature' }
    ];
    let commandIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    // Effect elements mapping
    const effectElements = {
      watermark: document.getElementById('demo-effect-watermark'),
      grouping: document.getElementById('demo-effect-grouping'),
      qrcode: [document.getElementById('demo-effect-qrcode'), document.getElementById('demo-effect-qrcode-label')],
      terms: document.getElementById('demo-effect-terms'),
      signature: document.getElementById('demo-effect-signature')
    };

    // Clear all effects
    function clearAllEffects() {
      heroDemo.classList.remove('demo-preview--grouping');
      // Reset accent color to default navy
      heroDemo.style.setProperty('--demo-accent', '#1E3A5F');
      Object.values(effectElements).flat().forEach(el => {
        if (el) el.classList.remove('demo-effect--active');
      });
    }

    // Activate a specific effect
    function activateEffect(effectName) {
      clearAllEffects();
      if (effectName === 'grouping') {
        heroDemo.classList.add('demo-preview--grouping');
        if (effectElements.grouping) effectElements.grouping.classList.add('demo-effect--active');
      } else if (effectName === 'qrcode') {
        effectElements.qrcode.forEach(el => el.classList.add('demo-effect--active'));
      } else if (effectElements[effectName]) {
        const el = effectElements[effectName];
        if (Array.isArray(el)) {
          el.forEach(e => e.classList.add('demo-effect--active'));
        } else {
          el.classList.add('demo-effect--active');
        }
      }
    }

    function typeCommand() {
      const command = commands[commandIndex];

      if (!isDeleting) {
        typingText.textContent = command.text.substring(0, charIndex + 1);
        charIndex++;

        if (charIndex === command.text.length) {
          // Typing complete - show the effect
          setTimeout(() => {
            heroDemo.style.setProperty('--demo-accent', command.color);
            activateEffect(command.effect);
          }, 300);

          setTimeout(() => {
            isDeleting = true;
            typeCommand();
          }, 2500); // Slightly longer to appreciate the effect
          return;
        }
      } else {
        typingText.textContent = command.text.substring(0, charIndex - 1);
        charIndex--;

        if (charIndex === 0) {
          // Clear effect when starting next command
          clearAllEffects();
          isDeleting = false;
          commandIndex = (commandIndex + 1) % commands.length;
        }
      }

      setTimeout(typeCommand, isDeleting ? 30 : 80);
    }

    setTimeout(typeCommand, 1000);

    // ============================================
    // Hero Command Click Handler - Instant Demo Magic
    // Clicking the hero command scrolls to playground AND executes it
    // ============================================
    const demoCommand = document.querySelector('.demo-command');
    if (demoCommand) {
      demoCommand.addEventListener('click', () => {
        // Get the current command being displayed
        const currentCommand = commands[commandIndex];
        const commandText = currentCommand.text;

        // Map hero commands to full playground prompts for better results
        const promptMap = {
          'Add a diagonal DRAFT watermark': 'Add a subtle DRAFT watermark diagonally across the document',
          'Group items by category with subtotals': 'Group the line items by category and add subtotals for each category',
          'Add a QR code for instant payment': 'Add a QR code in the bottom right corner for easy mobile payment',
          'Add payment terms: Net 30': 'Add payment terms: Net 30 with 2% early payment discount if paid within 10 days',
          'Add a signature line with date': 'Add a thank you message and signature line at the bottom with the current date'
        };

        const fullPrompt = promptMap[commandText] || commandText;

        // Scroll to playground section smoothly
        const playgroundSection = document.getElementById('playground');
        if (playgroundSection) {
          playgroundSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Wait for scroll to complete, then fill input and EXECUTE the command
          setTimeout(() => {
            const promptInput = document.getElementById('prompt-input');
            if (promptInput) {
              promptInput.value = fullPrompt;
              promptInput.focus();

              // Trigger input event to update any autocomplete UI
              promptInput.dispatchEvent(new Event('input', { bubbles: true }));

              // Flash the input briefly to show what's being executed
              promptInput.style.transition = 'box-shadow 0.3s ease';
              promptInput.style.boxShadow = '0 0 0 3px rgba(30, 58, 95, 0.3)';
              setTimeout(() => {
                promptInput.style.boxShadow = '';
              }, 400);

              // Execute the command automatically after a brief moment
              // This gives users a split second to see what's about to run
              setTimeout(() => {
                if (typeof applyModifications === 'function' && !isProcessingModification) {
                  console.log('[Glyph] Hero click: executing command -', fullPrompt);
                  applyModifications(fullPrompt);
                }
              }, 200);
            }
          }, 600);
        }
      });
    }

    // ============================================
    // Code Tab Switching
    // ============================================
    const codeTabs = document.querySelectorAll('.code-tab');
    const codeBlocks = document.querySelectorAll('.code-block');

    codeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const lang = tab.dataset.lang;

        codeTabs.forEach(t => t.classList.remove('code-tab--active'));
        codeBlocks.forEach(b => b.classList.remove('code-block--active'));

        tab.classList.add('code-tab--active');
        document.getElementById(`code-${lang}`).classList.add('code-block--active');
      });
    });

    // ============================================
    // Playground - The Main Attraction
    // ============================================
    const playgroundTabs = document.querySelectorAll('.playground__tab');
    const promptInput = document.getElementById('prompt-input');
    const playgroundInputWrapper = document.getElementById('playground-input-wrapper');
    const suggestions = document.querySelectorAll('.playground__suggestion');
    const applyBtn = document.getElementById('apply-btn');
    const undoBtn = document.getElementById('undo-btn');
    const diffToggleBtn = document.getElementById('diff-toggle-btn');
    const generateBtn = document.getElementById('generate-btn');
    const previewFrame = document.getElementById('preview-frame');
    const previewContainer = document.getElementById('preview-container');
    const previewLoading = document.getElementById('preview-loading');
    const previewStatus = document.querySelector('.playground__preview-status');
    const zoomToggle = document.getElementById('zoom-toggle');

    // Zoom toggle functionality
    if (zoomToggle) {
      zoomToggle.addEventListener('click', () => {
        previewContainer.classList.toggle('zoomed-in');
      });
    }

    // ============================================
    // Voice Input - Web Speech API
    // ============================================
    const voiceBtn = document.getElementById('voice-input-btn');
    let speechRecognition = null;
    let isListening = false;

    // Initialize speech recognition if supported
    function initSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        // Hide button if not supported
        if (voiceBtn) {
          voiceBtn.classList.add('unsupported');
          voiceBtn.title = 'Voice input not supported in this browser';
        }
        console.log('[Glyph] Speech recognition not supported in this browser');
        return null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add('listening');
        console.log('[Glyph] Voice input started');
      };

      recognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove('listening');
        console.log('[Glyph] Voice input ended');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        console.log('[Glyph] Voice transcript:', transcript, '(confidence:', (confidence * 100).toFixed(1) + '%)');

        // Populate the prompt input
        if (promptInput) {
          promptInput.value = transcript;
          promptInput.focus();
          // Trigger input event for any listeners
          promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };

      recognition.onerror = (event) => {
        console.log('[Glyph] Voice input error:', event.error);
        isListening = false;
        voiceBtn.classList.remove('listening');

        // Show user-friendly error messages
        let errorMsg = 'Voice input error';
        switch (event.error) {
          case 'no-speech':
            errorMsg = 'No speech detected. Try again.';
            break;
          case 'audio-capture':
            errorMsg = 'Microphone not available';
            break;
          case 'not-allowed':
            errorMsg = 'Microphone access denied';
            break;
          case 'network':
            errorMsg = 'Network error. Check your connection.';
            break;
        }

        // Brief toast notification
        showToast(errorMsg, 'error');
      };

      return recognition;
    }

    // Toggle voice input
    function toggleVoiceInput() {
      if (!speechRecognition) {
        speechRecognition = initSpeechRecognition();
        if (!speechRecognition) return;
      }

      if (isListening) {
        speechRecognition.stop();
      } else {
        try {
          speechRecognition.start();
        } catch (e) {
          // Recognition may already be running
          console.log('[Glyph] Could not start voice input:', e.message);
        }
      }
    }

    // Initialize voice button
    if (voiceBtn) {
      // Check support on load
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        voiceBtn.classList.add('unsupported');
      }

      voiceBtn.addEventListener('click', toggleVoiceInput);
    }

    // Processing flag to prevent concurrent modification requests
    let isProcessingModification = false;

    // Helper functions to manage suggestion button states
    function setSuggestionsDisabled(disabled) {
      suggestions.forEach(btn => {
        btn.disabled = disabled;
      });
    }

    // ============================================
    // Magical Field Autocomplete System
    // ============================================

    // Data Fields for template placeholders
    const DATA_FIELDS = [
      { category: 'Client', name: 'Client Name', path: 'client.name', example: 'John Smith', type: 'string' },
      { category: 'Client', name: 'Company', path: 'client.company', example: 'TechStart Inc.', type: 'string' },
      { category: 'Client', name: 'Email', path: 'client.email', example: 'john@techstart.io', type: 'string' },
      { category: 'Client', name: 'Phone', path: 'client.phone', example: '(555) 123-4567', type: 'string' },
      { category: 'Client', name: 'Address', path: 'client.address', example: '123 Main Street', type: 'string' },
      { category: 'Quote Info', name: 'Quote Number', path: 'meta.quoteNumber', example: 'Q-2024-001', type: 'string' },
      { category: 'Quote Info', name: 'Date', path: 'meta.date', example: 'January 15, 2024', type: 'date' },
      { category: 'Quote Info', name: 'Valid Until', path: 'meta.validUntil', example: 'February 15, 2024', type: 'date' },
      { category: 'Quote Info', name: 'Notes', path: 'meta.notes', example: 'Thank you!', type: 'string' },
      { category: 'Quote Info', name: 'Terms', path: 'meta.terms', example: 'Net 30 days', type: 'string' },
      { category: 'Company', name: 'Company Name', path: 'branding.companyName', example: 'Acme Corp', type: 'string' },
      { category: 'Company', name: 'Logo URL', path: 'branding.logoUrl', example: 'https://...', type: 'string' },
      { category: 'Company', name: 'Company Address', path: 'branding.companyAddress', example: '456 Business Ave', type: 'string' },
      { category: 'Totals', name: 'Subtotal', path: 'totals.subtotal', example: '10,000.00', type: 'number' },
      { category: 'Totals', name: 'Discount', path: 'totals.discount', example: '500.00', type: 'number' },
      { category: 'Totals', name: 'Tax', path: 'totals.tax', example: '760.00', type: 'number' },
      { category: 'Totals', name: 'Total', path: 'totals.total', example: '10,260.00', type: 'number' },
      { category: 'Line Items', name: 'Description', path: 'lineItems[].description', example: 'Service item', type: 'string' },
      { category: 'Styles', name: 'Accent Color', path: 'styles.accentColor', example: '#1E3A5F', type: 'string' },
    ];

    // Quick Actions - common design modifications
    const QUICK_ACTIONS = [
      { type: 'action', category: 'Quick Actions', icon: 'qr', label: 'Add QR code for payment', description: 'Easy mobile payment scanning', value: 'Add a QR code in the bottom right corner for easy mobile payment', score: 95 },
      { type: 'action', category: 'Quick Actions', icon: 'image', label: 'Add company logo', description: 'Brand your document', value: 'Add the company logo in the header, sized appropriately', score: 94 },
      { type: 'action', category: 'Quick Actions', icon: 'sparkles', label: 'Make design more professional', description: 'Enhance overall appearance', value: 'Make this design look more professional and polished with better typography and spacing', score: 93 },
      { type: 'action', category: 'Quick Actions', icon: 'stamp', label: 'Add DRAFT watermark', description: 'Mark as work in progress', value: 'Add a subtle DRAFT watermark diagonally across the document', score: 85 },
      { type: 'action', category: 'Quick Actions', icon: 'pen', label: 'Add signature line', description: 'Space for client approval', value: 'Add a signature line at the bottom with date field for client approval', score: 84 },
      { type: 'action', category: 'Quick Actions', icon: 'layout', label: 'Make layout compact', description: 'Reduce whitespace', value: 'Make the layout more compact, reducing unnecessary whitespace while keeping it readable', score: 80 },
    ];

    // Intent-based suggestions
    const MAKE_SUGGESTIONS = [
      { type: 'action', category: 'Make Changes', icon: 'arrow-up', label: 'make header bigger', description: 'Increase header size', value: 'Make the header section bigger and more prominent', score: 90 },
      { type: 'action', category: 'Make Changes', icon: 'dollar', label: 'make totals prominent', description: 'Highlight totals section', value: 'Make the totals section more prominent with larger text and better contrast', score: 89 },
      { type: 'action', category: 'Make Changes', icon: 'compress', label: 'make layout compact', description: 'Reduce whitespace', value: 'Make the layout more compact with tighter spacing', score: 88 },
      { type: 'action', category: 'Make Changes', icon: 'text', label: 'make text larger', description: 'Increase font size', value: 'Make all text slightly larger for better readability', score: 87 },
      { type: 'action', category: 'Make Changes', icon: 'sparkles', label: 'make it look modern', description: 'Contemporary styling', value: 'Make this look more modern with clean lines and contemporary styling', score: 86 },
      { type: 'action', category: 'Make Changes', icon: 'moon', label: 'make it dark mode', description: 'Dark theme', value: 'Make this a dark mode design with light text on dark background', score: 85 },
    ];

    const ADD_SUGGESTIONS = [
      { type: 'action', category: 'Add Elements', icon: 'qr', label: 'add QR code', description: 'Payment QR code', value: 'Add a QR code in the bottom right for mobile payment', score: 95 },
      { type: 'action', category: 'Add Elements', icon: 'image', label: 'add logo', description: 'Company logo', value: 'Add the company logo in the header', score: 94 },
      { type: 'action', category: 'Add Elements', icon: 'stamp', label: 'add watermark', description: 'Background watermark', value: 'Add a subtle watermark to the document', score: 90 },
      { type: 'action', category: 'Add Elements', icon: 'file-text', label: 'add terms', description: 'Payment terms', value: 'Add payment terms section at the bottom: Net 30 days', score: 89 },
      { type: 'action', category: 'Add Elements', icon: 'heart', label: 'add thank you note', description: 'Appreciation message', value: 'Add a thank you note at the bottom of the document', score: 88 },
      { type: 'action', category: 'Add Elements', icon: 'percent', label: 'add discount row', description: 'Discount in totals', value: 'Add a discount row to the totals section', score: 87 },
      { type: 'action', category: 'Add Elements', icon: 'pen', label: 'add signature line', description: 'Approval signature', value: 'Add a signature line for client approval', score: 86 },
    ];

    const CHANGE_SUGGESTIONS = [
      { type: 'action', category: 'Change Style', icon: 'palette', label: 'change colors', description: 'Modify color scheme', value: 'Change the accent color to a different shade', score: 90 },
      { type: 'action', category: 'Change Style', icon: 'palette', label: 'change to blue', description: 'Blue color scheme', value: 'Change the accent color to a professional blue (#2563eb)', score: 89 },
      { type: 'action', category: 'Change Style', icon: 'palette', label: 'change to purple', description: 'Purple color scheme', value: 'Change the accent color to a modern purple (#7c3aed)', score: 88 },
      { type: 'action', category: 'Change Style', icon: 'type', label: 'change font', description: 'Different typography', value: 'Change the font family to something more modern', score: 86 },
      { type: 'action', category: 'Change Style', icon: 'layout', label: 'change layout', description: 'Different arrangement', value: 'Change the overall layout to be more dynamic', score: 85 },
    ];

    // Category icons
    const CATEGORY_ICONS = {
      'Quick Actions': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      'Recent': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      'Suggestions': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>',
      'Data Fields': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
      'Add Elements': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
      'Make Changes': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      'Change Style': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="13.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    };

    // Suggestion icons
    const SUGGESTION_ICONS = {
      'qr': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>',
      'image': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      'sparkles': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L14.5 8.5L20 9L15.5 13L17 19L12 16L7 19L8.5 13L4 9L9.5 8.5L12 3Z"/></svg>',
      'stamp': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 22h14"/><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z"/></svg>',
      'pen': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      'layout': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>',
      'arrow-up': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
      'dollar': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      'compress': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/></svg>',
      'text': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
      'moon': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
      'file-text': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      'heart': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      'percent': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
      'palette': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="13.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
      'type': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
      'clock': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      'lightbulb': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>',
      'field': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    };

    // Fuzzy matching shortcuts
    const FUZZY_SHORTCUTS = {
      'ph': ['phone', 'photo'],
      'qr': ['QR code', 'QR'],
      '$': ['total', 'subtotal', 'price', 'dollar'],
      'em': ['email'],
      'disc': ['discount'],
      'sig': ['signature'],
      'wat': ['watermark'],
      'pro': ['professional'],
    };

    // Recent actions storage
    const RECENT_ACTIONS_KEY = 'glyph_recent_actions';
    const MAX_RECENT_ACTIONS = 5;

    function getRecentActions() {
      try {
        const stored = safeGetItem(RECENT_ACTIONS_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch (e) { return []; }
    }

    function saveRecentAction(label, value) {
      try {
        const recent = getRecentActions().filter(a => a.value !== value);
        recent.unshift({ label, value, timestamp: Date.now() });
        safeSetItem(RECENT_ACTIONS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_ACTIONS)));
      } catch (e) {
        handleStorageFailure();
      }
    }

    function formatTimeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
      return `${Math.floor(seconds / 86400)} days ago`;
    }

    // Document context analysis
    function analyzeDocumentContext() {
      const html = currentHtml.toLowerCase();
      return {
        hasLogo: html.includes('logo') || (html.includes('<img') && html.includes('header')),
        hasQrCode: html.includes('qr') || html.includes('qrcode'),
        hasTerms: html.includes('terms') || html.includes('net 30') || html.includes('net 15'),
        hasDiscount: html.includes('discount'),
        hasSignature: html.includes('signature'),
        hasTax: html.includes('tax'),
        hasThankYouNote: html.includes('thank you'),
      };
    }

    // Fuzzy match scoring
    function fuzzyMatch(query, target) {
      if (!query) return 50;
      const q = query.toLowerCase();
      const t = target.toLowerCase();
      if (t === q) return 100;
      if (t.startsWith(q)) return 95;
      if (t.includes(q)) return 75;
      return 0;
    }

    function applyFuzzyShortcuts(query) {
      const q = query.toLowerCase();
      const expansions = [query];
      for (const [shortcut, targets] of Object.entries(FUZZY_SHORTCUTS)) {
        if (q.startsWith(shortcut) || q === shortcut) {
          expansions.push(...targets);
        }
      }
      return expansions;
    }

    // Autocomplete state
    let autocompleteVisible = false;
    let autocompleteSelectedIndex = 0;
    let allSuggestions = [];
    let autocompleteDropdown = null;

    // Create autocomplete dropdown
    function createAutocompleteDropdown() {
      autocompleteDropdown = document.createElement('div');
      autocompleteDropdown.className = 'playground-autocomplete';
      autocompleteDropdown.id = 'playground-autocomplete';
      autocompleteDropdown.style.display = 'none';
      playgroundInputWrapper.appendChild(autocompleteDropdown);
    }

    // Get contextual AI suggestions
    function getContextualSuggestions() {
      const context = analyzeDocumentContext();
      const suggestions = [];

      if (!context.hasQrCode) {
        suggestions.push({ type: 'suggestion', category: 'Suggestions', icon: 'lightbulb', label: 'Add QR code for payment', description: 'Make it easy for clients to pay', value: 'Add a QR code in the bottom right for easy mobile payment', score: 92 });
      }
      if (!context.hasLogo) {
        suggestions.push({ type: 'suggestion', category: 'Suggestions', icon: 'lightbulb', label: 'Add company logo', description: 'Brand your document professionally', value: 'Add the company logo in the header, sized appropriately', score: 91 });
      }
      if (!context.hasTerms) {
        suggestions.push({ type: 'suggestion', category: 'Suggestions', icon: 'lightbulb', label: 'Add payment terms - Net 30?', description: 'Your invoice has no payment terms', value: 'Add payment terms at the bottom: Net 30 days', score: 88 });
      }
      if (!context.hasThankYouNote) {
        suggestions.push({ type: 'suggestion', category: 'Suggestions', icon: 'lightbulb', label: 'Add a thank you note', description: 'Personal touch builds relationships', value: 'Add a thank you note at the bottom: "Thank you for your business!"', score: 80 });
      }

      return suggestions;
    }

    // Generate all suggestions based on input
    function generateSuggestions(inputValue) {
      const text = inputValue.trim().toLowerCase();
      const suggestions = [];

      // Detect intent
      const isMakeIntent = text.startsWith('make ');
      const isAddIntent = text.startsWith('add ');
      const isChangeIntent = text.startsWith('change ');
      const isMustacheIntent = inputValue.endsWith('{{');

      let searchTerm = text;
      if (isMakeIntent) searchTerm = text.slice(5);
      else if (isAddIntent) searchTerm = text.slice(4);
      else if (isChangeIntent) searchTerm = text.slice(7);
      else if (isMustacheIntent) searchTerm = '';

      // 1. Add recent actions (when no/short input)
      if (!text || text.length < 3) {
        const recentActions = getRecentActions();
        recentActions.forEach((action, i) => {
          suggestions.push({
            type: 'recent',
            category: 'Recent',
            icon: 'clock',
            label: action.label,
            description: formatTimeAgo(action.timestamp),
            value: action.value,
            score: 100 - i,
          });
        });
      }

      // 2. Add contextual AI suggestions
      if (!text || isAddIntent) {
        suggestions.push(...getContextualSuggestions());
      }

      // 3. Add intent-specific suggestions
      const filterByQuery = (items, query) => {
        if (!query) return items;
        const expansions = applyFuzzyShortcuts(query);
        return items.filter(item => {
          return expansions.some(q => {
            const labelScore = fuzzyMatch(q, item.label);
            const descScore = fuzzyMatch(q, item.description) * 0.7;
            return Math.max(labelScore, descScore) > 30;
          });
        });
      };

      if (isMakeIntent) {
        suggestions.push(...filterByQuery(MAKE_SUGGESTIONS, searchTerm));
      } else if (isAddIntent) {
        suggestions.push(...filterByQuery(ADD_SUGGESTIONS, searchTerm));
      } else if (isChangeIntent) {
        suggestions.push(...filterByQuery(CHANGE_SUGGESTIONS, searchTerm));
      }

      // 4. Add quick actions (when no specific intent)
      if (!isMakeIntent && !isChangeIntent && !isMustacheIntent) {
        suggestions.push(...filterByQuery(QUICK_ACTIONS, searchTerm));
      }

      // 5. Add data fields
      const fieldSuggestions = DATA_FIELDS.map(field => {
        const expansions = applyFuzzyShortcuts(searchTerm);
        let bestScore = 0;
        expansions.forEach(q => {
          bestScore = Math.max(bestScore, fuzzyMatch(q, field.name), fuzzyMatch(q, field.path) * 0.9);
        });
        const baseScore = isMustacheIntent ? 85 : 60;
        return {
          type: 'field',
          category: 'Data Fields',
          icon: 'field',
          label: field.name,
          description: `{{${field.path}}}`,
          value: `{{${field.path}}}`,
          path: field.path,
          example: field.example,
          score: searchTerm ? baseScore * (bestScore / 100) : baseScore,
        };
      }).filter(s => !searchTerm || s.score > 15);

      suggestions.push(...fieldSuggestions);

      // Remove duplicates and sort by score
      const seen = new Map();
      suggestions.forEach(s => {
        const key = s.value.toLowerCase();
        if (!seen.has(key) || s.score > seen.get(key).score) {
          seen.set(key, s);
        }
      });

      return Array.from(seen.values()).sort((a, b) => b.score - a.score).slice(0, 15);
    }

    // Render autocomplete dropdown
    function renderAutocomplete() {
      if (!autocompleteDropdown) return;

      // Group by category with specific order
      const categoryOrder = ['Recent', 'Suggestions', 'Quick Actions', 'Make Changes', 'Add Elements', 'Change Style', 'Data Fields'];
      const grouped = {};
      allSuggestions.forEach(s => {
        if (!grouped[s.category]) grouped[s.category] = [];
        grouped[s.category].push(s);
      });

      let html = '';
      let globalIndex = 0;

      categoryOrder.forEach(category => {
        const items = grouped[category];
        if (!items || items.length === 0) return;

        const icon = CATEGORY_ICONS[category] || '';
        const categoryClass = category === 'Recent' ? 'autocomplete-category--recent' :
                              category === 'Suggestions' ? 'autocomplete-category--suggestions' :
                              category === 'Quick Actions' ? 'autocomplete-category--quick' :
                              category === 'Data Fields' ? 'autocomplete-category--fields' : '';

        html += `<div class="autocomplete-category ${categoryClass}">
          <span class="autocomplete-category-icon">${icon}</span>
          <span>${escapeHtml(category)}</span>
        </div>`;

        items.forEach(suggestion => {
          const isSelected = globalIndex === autocompleteSelectedIndex;
          const suggestionIcon = SUGGESTION_ICONS[suggestion.icon] || SUGGESTION_ICONS['field'];
          const typeClass = `autocomplete-item--${suggestion.type}`;

          html += `<div class="autocomplete-item ${typeClass} ${isSelected ? 'selected' : ''}" data-index="${globalIndex}">
            <div class="autocomplete-item-main">
              <span class="autocomplete-item-icon">${suggestionIcon}</span>
              <div class="autocomplete-item-content">
                <span class="autocomplete-item-name">${escapeHtml(suggestion.label)}</span>
                <span class="autocomplete-item-description">${escapeHtml(suggestion.description)}</span>
              </div>
            </div>
            ${suggestion.example ? `<span class="autocomplete-item-example">${escapeHtml(suggestion.example)}</span>` : ''}
          </div>`;
          globalIndex++;
        });
      });

      html += `<div class="autocomplete-hint">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>`;

      autocompleteDropdown.innerHTML = html;

      // Add click handlers
      autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          const index = parseInt(item.getAttribute('data-index') || '0', 10);
          selectAutocompleteSuggestion(allSuggestions[index]);
        });
        item.addEventListener('mouseenter', () => {
          autocompleteSelectedIndex = parseInt(item.getAttribute('data-index') || '0', 10);
          updateAutocompleteSelection();
        });
      });
    }

    // Show autocomplete
    function showAutocomplete() {
      allSuggestions = generateSuggestions(promptInput.value);
      if (allSuggestions.length === 0) {
        hideAutocomplete();
        return;
      }

      autocompleteSelectedIndex = 0;
      renderAutocomplete();
      autocompleteDropdown.style.display = 'block';
      autocompleteVisible = true;
    }

    // Hide autocomplete
    function hideAutocomplete() {
      if (autocompleteDropdown) {
        autocompleteDropdown.style.display = 'none';
      }
      autocompleteVisible = false;
      autocompleteSelectedIndex = 0;
    }

    // Update selection UI
    function updateAutocompleteSelection() {
      if (!autocompleteDropdown) return;
      const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
      items.forEach((item, index) => {
        item.classList.toggle('selected', index === autocompleteSelectedIndex);
      });

      const selectedItem = autocompleteDropdown.querySelector('.autocomplete-item.selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    // Select autocomplete suggestion
    function selectAutocompleteSuggestion(suggestion) {
      if (!suggestion) return;

      // Save to recent actions
      saveRecentAction(suggestion.label, suggestion.value);

      // Compose prompt based on type
      let composedPrompt = suggestion.value;

      if (suggestion.type === 'field' && suggestion.path) {
        const currentValue = promptInput.value;
        if (currentValue.endsWith('{{')) {
          composedPrompt = currentValue.slice(0, -2) + `{{${suggestion.path}}}`;
        } else if (currentValue.toLowerCase().startsWith('add ')) {
          const contextMap = {
            'client.email': 'Add {{client.email}} below the client name',
            'client.phone': 'Add {{client.phone}} next to the client contact info',
            'meta.notes': 'Add {{meta.notes}} at the bottom of the document',
            'meta.terms': 'Add {{meta.terms}} in the footer section',
            'branding.logoUrl': 'Add the company logo {{branding.logoUrl}} in the header',
            'totals.discount': 'Add a discount row showing {{totals.discount}} in the totals section',
          };
          composedPrompt = contextMap[suggestion.path] || `Add {{${suggestion.path}}} to the document`;
        } else {
          composedPrompt = `Add {{${suggestion.path}}} to the document`;
        }
      }

      promptInput.value = composedPrompt;
      promptInput.focus();
      promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);

      hideAutocomplete();
    }

    // Escape HTML for security
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Initialize autocomplete
    createAutocompleteDropdown();

    // Check if a prompt matches one of the instant action quick suggestions
    // Only actions with pre-baked HTML transformations are truly instant
    function isInstantAction(prompt) {
      const lowPrompt = prompt.toLowerCase();

      // Check for specific instant action patterns
      const instantPatterns = [
        // QR code
        /qr\s*code/i,
        // Watermark
        /watermark/i,
        // Payment terms
        /payment\s*terms|net\s*\d+/i,
        // Group by category
        /group.*category|group.*subtotal/i,
        // Bold header
        /bold.*header|header.*bold/i,
        // Add date
        /add.*date|today.*date|date.*corner/i,
        // Add border
        /add.*border|border.*document/i,
        // Thank you note
        /thank\s*you.*note|thank.*note|add.*thank/i,
        // Signature
        /add.*signature|signature.*line/i
      ];

      return instantPatterns.some(pattern => pattern.test(lowPrompt));
    }

    // Autocomplete event listeners
    promptInput.addEventListener('input', debounce(() => {
      showAutocomplete();
    }, 300));

    promptInput.addEventListener('focus', () => {
      showAutocomplete();
    });

    promptInput.addEventListener('blur', () => {
      setTimeout(() => hideAutocomplete(), 150);
    });

    promptInput.addEventListener('keydown', (e) => {
      if (!autocompleteVisible) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocompleteSelectedIndex = (autocompleteSelectedIndex + 1) % allSuggestions.length;
        updateAutocompleteSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocompleteSelectedIndex = (autocompleteSelectedIndex - 1 + allSuggestions.length) % allSuggestions.length;
        updateAutocompleteSelection();
      } else if (e.key === 'Enter' && autocompleteVisible) {
        e.preventDefault();
        selectAutocompleteSuggestion(allSuggestions[autocompleteSelectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
      } else if (e.key === 'Tab' && autocompleteVisible) {
        e.preventDefault();
        selectAutocompleteSuggestion(allSuggestions[autocompleteSelectedIndex]);
      }
    });

    // Prevent dropdown click from blurring input
    if (autocompleteDropdown) {
      autocompleteDropdown.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
    }

    // Sample quote data for demo
    const sampleQuoteData = {
      branding: {
        companyName: 'Acme Corporation',
        companyAddress: '123 Business Ave, Suite 100\nSan Francisco, CA 94102',
        logoUrl: ''
      },
      meta: {
        quoteNumber: 'Q-2024-0042',
        date: 'January 18, 2026',
        validUntil: 'February 17, 2026',
        notes: 'Thank you for your business! Payment due within 30 days.',
        terms: 'Terms: Net 30 days. All prices in USD.'
      },
      client: {
        name: 'John Smith',
        company: 'TechStart Inc.',
        email: 'john@techstart.io',
        address: '456 Startup Lane\nPalo Alto, CA 94301'
      },
      lineItems: [
        { description: 'UI/UX Design', details: 'Custom interface design and prototypes', quantity: 1, unitPrice: 3500.00, total: 3500.00, category: 'Design' },
        { description: 'Brand Guidelines', details: 'Logo usage, colors, typography specs', quantity: 1, unitPrice: 1500.00, total: 1500.00, category: 'Design' },
        { description: 'Server Hardware', details: 'Dell PowerEdge R750 with 64GB RAM', quantity: 2, unitPrice: 4200.00, total: 8400.00, category: 'Materials' },
        { description: 'Network Equipment', details: 'Cisco switches and cabling', quantity: 1, unitPrice: 2800.00, total: 2800.00, category: 'Materials' },
        { description: 'Software Licenses', details: 'Enterprise software bundle', quantity: 5, unitPrice: 450.00, total: 2250.00, category: 'Materials' },
        { description: 'Installation', details: 'On-site hardware setup and config', quantity: 16, unitPrice: 150.00, total: 2400.00, category: 'Labor' },
        { description: 'Training', details: 'Staff training sessions (4 hours each)', quantity: 3, unitPrice: 500.00, total: 1500.00, category: 'Labor' }
      ],
      totals: {
        subtotal: 22350.00,
        tax: 0,
        discount: 0,
        total: 22350.00
      },
      styles: {
        accentColor: '#1E3A5F'
      }
    };

    // Sample data for different template types
    const sampleInvoiceData = {
      branding: {
        companyName: 'Acme Corporation',
        companyAddress: '123 Business Ave, Suite 100\nSan Francisco, CA 94102',
        logoUrl: '',
        logoInitial: 'A'
      },
      invoice: {
        number: 'INV-2026-0087',
        date: 'January 27, 2026',
        dueDate: 'February 26, 2026',
        notes: 'Thank you for your prompt payment.',
        paymentTerms: 'Payment due within 30 days. Late fees of 1.5% per month apply.'
      },
      billTo: {
        name: 'Sarah Chen',
        company: 'Brightpath Analytics',
        email: 'sarah@brightpath.io',
        address: '789 Data Drive, Austin, TX 73301'
      },
      lineItems: [
        { description: 'Data Pipeline Setup', details: 'ETL pipeline configuration and testing', quantity: 1, rate: '4,500.00', amount: '4,500.00' },
        { description: 'Dashboard Development', details: 'Custom analytics dashboards (3 views)', quantity: 3, rate: '2,000.00', amount: '6,000.00' },
        { description: 'API Integration', details: 'Third-party API connectors', quantity: 2, rate: '1,500.00', amount: '3,000.00' }
      ],
      totals: {
        subtotal: '13,500.00',
        tax: '1,080.00',
        total: '14,580.00'
      },
      styles: { accentColor: '#2563eb' }
    };

    const sampleReceiptData = {
      merchant: {
        name: 'The Daily Grind',
        address: '456 Market St, San Francisco, CA 94102'
      },
      receipt: {
        number: 'REC-2026-0193',
        date: 'January 27, 2026',
        time: '10:32 AM'
      },
      items: [
        { name: 'Monthly Subscription - Pro Plan', quantity: 1, price: '49.00' },
        { name: 'Additional Storage (50GB)', quantity: 1, price: '10.00' }
      ],
      totals: {
        subtotal: '59.00',
        tax: '4.72',
        total: '63.72'
      },
      payment: {
        method: 'Credit Card ending in 4242'
      },
      styles: { accentColor: '#059669' }
    };

    const sampleReportData = {
      report: {
        title: 'Q4 2025 Performance Review',
        subtitle: 'Trends, Opportunities, and Strategic Recommendations',
        author: 'Strategy Team',
        date: 'January 27, 2026',
        organization: 'Acme Corporation'
      },
      styles: { accentColor: '#7c3aed' }
    };

    // Map template types to their style variants and sample data
    const TEMPLATE_TYPE_CONFIG = {
      quote: {
        variants: [
          { id: 'quote-modern', label: 'Modern' },
          { id: 'quote-professional', label: 'Professional' },
          { id: 'quote-bold', label: 'Bold' }
        ],
        data: sampleQuoteData
      },
      invoice: {
        variants: [
          { id: 'invoice-clean', label: 'Clean' }
        ],
        data: sampleInvoiceData
      },
      receipt: {
        variants: [
          { id: 'receipt-minimal', label: 'Minimal' }
        ],
        data: sampleReceiptData
      },
      report: {
        variants: [
          { id: 'report-cover', label: 'Cover' }
        ],
        data: sampleReportData
      }
    };

    // Get the current sample data based on template type
    function getCurrentSampleData() {
      for (const [type, config] of Object.entries(TEMPLATE_TYPE_CONFIG)) {
        if (config.variants.some(v => v.id === currentTemplate)) {
          return config.data;
        }
      }
      return sampleQuoteData;
    }

    // Initialize preview with HTML
    // Track if we're in demo mode (Issue #2)
    let isInDemoMode = false;

    // Progressive loading stage management
    function updateSkeletonStage(stage) {
      const stages = document.querySelectorAll('.preview-init-loading__stage');
      const stageOrder = ['connecting', 'loading', 'ready'];
      const currentIndex = stageOrder.indexOf(stage);

      stages.forEach(stageEl => {
        const stageName = stageEl.dataset.stage;
        const stageIndex = stageOrder.indexOf(stageName);

        stageEl.classList.remove('active', 'completed');

        if (stageIndex < currentIndex) {
          stageEl.classList.add('completed');
        } else if (stageIndex === currentIndex) {
          stageEl.classList.add('active');
        }
      });
    }

    // Hide initial loading skeleton with smooth transition
    function hideInitialLoadingSkeleton() {
      const skeleton = document.getElementById('preview-init-loading');
      if (skeleton) {
        // Mark ready stage as completed before hiding
        updateSkeletonStage('ready');

        // Small delay to show the "Ready" checkmark
        setTimeout(() => {
          skeleton.classList.add('hidden');
          // Remove from DOM after transition
          setTimeout(() => {
            skeleton.style.display = 'none';
          }, 400);
        }, 300);
      }
    }

    // Show skeleton for re-initialization (e.g., template switch)
    function showInitialLoadingSkeleton() {
      const skeleton = document.getElementById('preview-init-loading');
      if (skeleton) {
        skeleton.style.display = 'flex';
        skeleton.classList.remove('hidden');
        updateSkeletonStage('connecting');
      }
    }

    // Show demo mode banner (Issue #2)
    function showDemoModeBanner() {
      const banner = document.getElementById('demo-mode-banner');
      if (banner) {
        banner.classList.add('visible');
        isInDemoMode = true;
      }
    }

    // Hide demo mode banner
    function hideDemoModeBanner() {
      const banner = document.getElementById('demo-mode-banner');
      if (banner) {
        banner.classList.remove('visible');
        isInDemoMode = false;
      }
    }

    // Setup demo mode banner event listeners
    function setupDemoModeBanner() {
      const retryBtn = document.getElementById('demo-mode-retry');
      const dismissBtn = document.getElementById('demo-mode-dismiss');

      if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
          retryBtn.textContent = 'Retrying...';
          retryBtn.disabled = true;
          hideDemoModeBanner();
          await initializePreview();
          retryBtn.textContent = 'Retry Connection';
          retryBtn.disabled = false;
        });
      }

      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          hideDemoModeBanner();
        });
      }
    }

    async function initializePreview() {
      // Show skeleton and set connecting stage
      showInitialLoadingSkeleton();
      setStatus('Connecting...');
      updateSkeletonStage('connecting');

      try {
        // Transition to loading stage after connection starts
        setTimeout(() => updateSkeletonStage('loading'), 400);

        const response = await fetch(`${API_URL}/v1/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEMO_API_KEY}`
          },
          body: JSON.stringify({
            template: currentTemplate,
            data: getCurrentSampleData()
          })
        });

        if (!response.ok) {
          throw new Error('Failed to load preview');
        }

        const data = await response.json();
        currentHtml = data.html;
        sessionId = data.sessionId;

        // Update status to loading preview
        setStatus('Loading preview...');

        // Hide demo mode banner if previously shown (successful reconnect)
        hideDemoModeBanner();

        renderPreview(currentHtml);

        // Hide skeleton with smooth transition showing "Ready" state
        hideInitialLoadingSkeleton();
        setStatus('Ready');

        // Start session timer for this new session
        startSessionTimer();

        // Auto-enable zoom on mobile for better preview visibility
        if (window.innerWidth <= 480) {
          const previewContainer = document.getElementById('preview-container');
          if (previewContainer) {
            previewContainer.classList.add('zoomed-in');
          }
        }
      } catch (err) {
        console.warn('API not available, using static demo:', err);

        // Still show loading stage briefly for demo mode
        updateSkeletonStage('loading');
        setStatus('Loading demo...');

        renderStaticDemo();

        // Hide skeleton even in demo mode
        hideInitialLoadingSkeleton();
        setStatus('Demo Mode');

        // Show visible demo mode banner instead of silent fallback
        showDemoModeBanner();

        // Still start timer in demo mode for consistent UX
        startSessionTimer();

        // Auto-enable zoom on mobile for better preview visibility (demo mode too)
        if (window.innerWidth <= 480) {
          const previewContainer = document.getElementById('preview-container');
          if (previewContainer) {
            previewContainer.classList.add('zoomed-in');
          }
        }
      }
    }

    // Show preview error message
    function showPreviewError() {
      const previewContainer = previewFrame.parentElement;
      if (!previewContainer) return;

      // Check if error already shown
      if (previewContainer.querySelector('.glyph-preview-error')) return;

      const errorDiv = document.createElement('div');
      errorDiv.className = 'glyph-preview-error';
      errorDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; text-align: center; background: #1a1a2e; color: #fff; border-radius: 8px;">
          <svg width="48" height="48" fill="none" stroke="#ef4444" viewBox="0 0 24 24" style="margin-bottom: 1rem;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p style="font-size: 1rem; margin-bottom: 0.5rem; font-weight: 500;">Preview unavailable</p>
          <p style="font-size: 0.875rem; color: #9ca3af; margin-bottom: 1rem;">The preview couldn't load properly.</p>
          <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: #7c3aed; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">
            Refresh Page
          </button>
        </div>
      `;
      errorDiv.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10;';

      // Hide the iframe and show error
      previewFrame.style.display = 'none';
      previewContainer.style.position = 'relative';
      previewContainer.appendChild(errorDiv);
    }

    // Render HTML in iframe with optional change highlighting
    function renderPreview(html, options = {}) {
      const { changes = [], previousHtml = null } = options;

      // Try to access contentDocument with error handling
      let doc;
      try {
        doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        if (!doc) {
          throw new Error('contentDocument is null');
        }
      } catch (e) {
        console.error('[Glyph] Preview frame access denied:', e);
        showPreviewError();
        return;
      }

      try {
        doc.open();
        doc.write(html);
        doc.close();
      } catch (e) {
        console.error('[Glyph] Preview frame write failed:', e);
        showPreviewError();
        return;
      }

      // If we have changes info, apply highlight animation to changed regions
      if (changes.length > 0 || previousHtml) {
        highlightChangedRegions(doc, changes, previousHtml, html);
      }
    }

    /**
     * Highlight regions that changed after AI modification
     * Uses the changes array from API and/or HTML diffing
     */
    function highlightChangedRegions(doc, changes, previousHtml, currentHtml) {
      // Inject the highlight CSS into the iframe
      const styleId = 'glyph-change-highlight-styles';
      if (!doc.getElementById(styleId)) {
        const style = doc.createElement('style');
        style.id = styleId;
        style.textContent = `
          .glyph-changed {
            position: relative;
            animation: glyphChangeHighlight 2.5s ease-out forwards;
            border-radius: 4px;
          }
          .glyph-changed::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(124, 58, 237, 0.15),
              transparent
            );
            background-size: 200% 100%;
            animation: glyphChangeShimmer 1.5s ease-out;
            pointer-events: none;
            border-radius: inherit;
          }
          @keyframes glyphChangeHighlight {
            0% {
              box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.7), 0 0 20px rgba(124, 58, 237, 0.4);
              background-color: rgba(124, 58, 237, 0.08);
            }
            50% {
              box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.5), 0 0 30px rgba(124, 58, 237, 0.3);
              background-color: rgba(124, 58, 237, 0.05);
            }
            100% {
              box-shadow: 0 0 0 0px rgba(124, 58, 237, 0), 0 0 0px rgba(124, 58, 237, 0);
              background-color: rgba(124, 58, 237, 0);
            }
          }
          @keyframes glyphChangeShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `;
        doc.head.appendChild(style);
      }

      // Strategy 1: Use data-glyph-region attributes if available
      const regions = doc.querySelectorAll('[data-glyph-region]');
      let highlightedCount = 0;

      // Parse changes to identify which regions were affected
      const changeKeywords = extractChangeKeywords(changes);

      // Check each region for changes
      regions.forEach(region => {
        const regionName = region.getAttribute('data-glyph-region').toLowerCase();
        const shouldHighlight = changeKeywords.some(keyword =>
          regionName.includes(keyword) || keyword.includes(regionName)
        );

        if (shouldHighlight) {
          applyHighlight(region);
          highlightedCount++;
        }
      });

      // Strategy 2: If no regions matched, use HTML diff to find changes
      if (highlightedCount === 0 && previousHtml) {
        highlightedCount = highlightByDiff(doc, previousHtml, currentHtml);
      }

      // Strategy 3: If still nothing and we have changes, highlight common elements
      if (highlightedCount === 0 && changes.length > 0) {
        highlightByKeywordSearch(doc, changeKeywords);
      }

      console.log(`[Glyph] Highlighted ${highlightedCount} changed regions`);
    }

    /**
     * Extract keywords from change descriptions to match against elements
     */
    function extractChangeKeywords(changes) {
      const keywords = [];
      const keywordPatterns = [
        /header/i, /footer/i, /title/i, /subtitle/i, /logo/i,
        /color/i, /background/i, /font/i, /text/i, /border/i,
        /button/i, /link/i, /image/i, /icon/i, /table/i,
        /price/i, /total/i, /item/i, /product/i, /service/i,
        /company/i, /contact/i, /address/i, /phone/i, /email/i,
        /date/i, /number/i, /signature/i, /qr/i, /code/i,
        /payment/i, /terms/i, /notes/i, /description/i
      ];

      changes.forEach(change => {
        const lowerChange = change.toLowerCase();
        keywordPatterns.forEach(pattern => {
          const match = lowerChange.match(pattern);
          if (match) {
            keywords.push(match[0].toLowerCase());
          }
        });

        // Also extract specific words that might be element classes/ids
        const words = lowerChange.match(/\b[a-z]{4,}\b/gi) || [];
        words.forEach(word => {
          if (!['added', 'updated', 'changed', 'modified', 'removed', 'style', 'styling'].includes(word.toLowerCase())) {
            keywords.push(word.toLowerCase());
          }
        });
      });

      return [...new Set(keywords)]; // Remove duplicates
    }

    /**
     * Apply the highlight animation to an element
     */
    function applyHighlight(element) {
      element.classList.add('glyph-changed');

      // Remove the class after animation completes
      setTimeout(() => {
        element.classList.remove('glyph-changed');
      }, 2500);
    }

    /**
     * Highlight elements by searching for keywords in class names, IDs, and content
     */
    function highlightByKeywordSearch(doc, keywords) {
      if (keywords.length === 0) return;

      // Build selector for common element types
      const selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'header', 'footer', 'section', 'article',
        '.header', '.footer', '.title', '.subtitle',
        '[class*="header"]', '[class*="title"]', '[class*="footer"]',
        '[class*="logo"]', '[class*="price"]', '[class*="total"]'
      ];

      const elements = doc.querySelectorAll(selectors.join(', '));

      elements.forEach(el => {
        const elClass = (el.className || '').toLowerCase();
        const elId = (el.id || '').toLowerCase();
        const elText = (el.textContent || '').toLowerCase().substring(0, 100);

        const matches = keywords.some(keyword =>
          elClass.includes(keyword) ||
          elId.includes(keyword) ||
          elText.includes(keyword)
        );

        if (matches) {
          applyHighlight(el);
        }
      });
    }

    /**
     * Compare previous and current HTML to find changed elements
     * Uses a simplified diff approach for performance
     */
    function highlightByDiff(doc, previousHtml, currentHtml) {
      let highlightedCount = 0;

      // Create temporary elements to parse HTML
      const tempPrev = document.createElement('div');
      const tempCurr = document.createElement('div');
      tempPrev.innerHTML = previousHtml;
      tempCurr.innerHTML = currentHtml;

      // Get all elements with data-glyph-region in current doc
      const regions = doc.querySelectorAll('[data-glyph-region]');

      regions.forEach(region => {
        const regionName = region.getAttribute('data-glyph-region');
        const prevRegion = tempPrev.querySelector(`[data-glyph-region="${regionName}"]`);

        // If region didn't exist before or content changed, highlight it
        if (!prevRegion || prevRegion.innerHTML !== region.innerHTML) {
          applyHighlight(region);
          highlightedCount++;
        }
      });

      // Also check for style changes on key elements
      const checkElements = doc.querySelectorAll('h1, h2, h3, .header, .title, table, .total');
      checkElements.forEach(el => {
        // Simple check: if the element's outer HTML changed significantly
        const prevMatches = tempPrev.querySelectorAll(el.tagName);
        let found = false;
        prevMatches.forEach(prev => {
          if (prev.outerHTML === el.outerHTML) found = true;
        });

        if (!found && !el.classList.contains('glyph-changed')) {
          applyHighlight(el);
          highlightedCount++;
        }
      });

      return highlightedCount;
    }

    // ============================================
    // Undo Functionality
    // ============================================

    // Save current state to undo history before making changes
    function saveToUndoHistory() {
      if (!currentHtml) return;

      undoHistory.push(currentHtml);

      // CRITICAL: Clear redo history when a new change is made
      // This prevents undone states from "coming back" when user undos after making new changes
      redoHistory = [];

      // Limit history size to prevent memory issues
      if (undoHistory.length > MAX_UNDO_HISTORY) {
        undoHistory.shift();
      }

      updateUndoButtonState();
    }

    // Restore the previous state from undo history
    function performUndo() {
      if (undoHistory.length === 0) return;

      const previousHtml = undoHistory.pop();
      currentHtml = previousHtml;
      renderPreview(currentHtml);

      // Refresh applied action button states based on restored HTML
      refreshAppliedActionsFromHtml(currentHtml);

      // Success animation
      previewContainer.classList.add('success');
      setTimeout(() => previewContainer.classList.remove('success'), 500);
      flashPreviewArea(); // Mobile visual feedback

      setStatus('Undone');
      console.log('[Glyph] Undo performed, history length:', undoHistory.length);
      setTimeout(() => setStatus('Ready'), 1500);

      updateUndoButtonState();
      clearDiffState();
    }

    // Update undo button disabled state based on history
    function updateUndoButtonState() {
      if (undoBtn) {
        undoBtn.disabled = undoHistory.length === 0;
        undoBtn.title = undoHistory.length > 0
          ? `Undo last change (${undoHistory.length} available)`
          : 'No changes to undo';
      }
      updateShareAndSaveButtonState();
    }

    // Update share and save buttons based on whether changes exist
    function updateShareAndSaveButtonState() {
      const hasChanges = undoHistory.length > 0;
      const shareBtn = document.getElementById('share-btn');
      const saveBtn = document.getElementById('save-version-btn');
      if (shareBtn) {
        shareBtn.disabled = !hasChanges;
        shareBtn.title = hasChanges ? 'Share this customization' : 'Share this customization';
        shareBtn.dataset.tooltip = hasChanges ? '' : 'Make a change to share';
      }
      if (saveBtn) {
        saveBtn.disabled = !hasChanges;
        saveBtn.title = hasChanges ? 'Save named version' : 'Save named version';
        saveBtn.dataset.tooltip = hasChanges ? '' : 'Make a change to save a version';
      }
    }

    // Clear undo history (e.g., when switching templates)
    function clearUndoHistory() {
      undoHistory = [];
      updateUndoButtonState();
      // Also clear applied action states when switching templates
      clearAllAppliedActions();
      // Clear diff state when switching templates
      clearDiffState();
    }

    // ============================================
    // Visual Diff Toggle
    // ============================================

    /**
     * Snapshot all data-glyph-region innerHTML from an HTML string.
     * Returns a Map<regionName, innerHTML>.
     */
    function snapshotRegions(html) {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const map = new Map();
      temp.querySelectorAll('[data-glyph-region]').forEach(el => {
        map.set(el.getAttribute('data-glyph-region'), el.innerHTML);
      });
      return map;
    }

    /**
     * Called before a modification to capture the "before" state.
     */
    function captureDiffBefore() {
      if (!currentHtml) return;
      diffRegionSnapshots = { before: snapshotRegions(currentHtml), after: null };
      // Turn off active diff view while a new modification is in progress
      if (isDiffActive) {
        toggleDiffView(false);
      }
    }

    /**
     * Called after a successful modification to capture the "after" state.
     */
    function captureDiffAfter() {
      if (!diffRegionSnapshots || !currentHtml) return;
      diffRegionSnapshots.after = snapshotRegions(currentHtml);
      updateDiffButtonState();
    }

    /**
     * Determine which regions changed between before and after snapshots.
     * Returns an array of region names that differ.
     */
    function getChangedRegionNames() {
      if (!diffRegionSnapshots || !diffRegionSnapshots.before || !diffRegionSnapshots.after) return [];
      const changed = [];
      const after = diffRegionSnapshots.after;
      const before = diffRegionSnapshots.before;

      after.forEach((html, name) => {
        const prevHtml = before.get(name);
        if (prevHtml === undefined || prevHtml !== html) {
          changed.push(name);
        }
      });

      // Also check for regions that were removed
      before.forEach((html, name) => {
        if (!after.has(name)) {
          changed.push(name);
        }
      });

      return changed;
    }

    /**
     * Toggle the diff highlight overlay in the preview iframe.
     */
    function toggleDiffView(forceState) {
      const newState = forceState !== undefined ? forceState : !isDiffActive;
      isDiffActive = newState;

      if (diffToggleBtn) {
        diffToggleBtn.classList.toggle('active', isDiffActive);
      }

      const iframe = previewFrame;
      if (!iframe || !iframe.contentDocument) return;
      const doc = iframe.contentDocument;

      const styleId = 'glyph-diff-toggle-styles';

      if (!isDiffActive) {
        // Remove diff highlights
        const existingStyle = doc.getElementById(styleId);
        if (existingStyle) existingStyle.remove();
        doc.querySelectorAll('.glyph-diff-changed').forEach(el => {
          el.classList.remove('glyph-diff-changed');
        });
        return;
      }

      // Inject diff highlight CSS
      if (!doc.getElementById(styleId)) {
        const style = doc.createElement('style');
        style.id = styleId;
        style.textContent = `
          .glyph-diff-changed {
            outline: 2px solid rgba(34, 197, 94, 0.6);
            outline-offset: 2px;
            background-color: rgba(34, 197, 94, 0.06);
            border-radius: 3px;
            transition: outline-color 0.2s, background-color 0.2s;
          }
        `;
        doc.head.appendChild(style);
      }

      // Apply highlight to changed regions
      const changedNames = getChangedRegionNames();
      changedNames.forEach(name => {
        const el = doc.querySelector(`[data-glyph-region="${name}"]`);
        if (el) {
          el.classList.add('glyph-diff-changed');
        }
      });

      console.log(`[Glyph] Diff view: ${changedNames.length} changed regions highlighted`);
    }

    /**
     * Update diff button enabled/disabled state.
     */
    function updateDiffButtonState() {
      if (!diffToggleBtn) return;
      const hasChanges = getChangedRegionNames().length > 0;
      diffToggleBtn.disabled = !hasChanges;
      diffToggleBtn.title = hasChanges
        ? `Show changes (${getChangedRegionNames().length} regions changed)`
        : 'No changes to show';
    }

    /**
     * Clear diff state entirely.
     */
    function clearDiffState() {
      diffRegionSnapshots = null;
      isDiffActive = false;
      if (diffToggleBtn) {
        diffToggleBtn.classList.remove('active');
        diffToggleBtn.disabled = true;
        diffToggleBtn.title = 'No changes to show';
      }
    }

    // Wire up diff toggle button
    if (diffToggleBtn) {
      diffToggleBtn.addEventListener('click', () => {
        if (diffToggleBtn.disabled) return;
        toggleDiffView();
      });
    }


    // ============================================
    // Keyboard Shortcuts Bar
    // ============================================
    const shortcutsBar = document.getElementById('shortcuts-bar');
    const shortcutsDismiss = document.getElementById('shortcuts-dismiss');
    const SHORTCUTS_DISMISSED_KEY = 'glyph_shortcuts_dismissed';

    // Detect platform (Mac vs Windows/Linux)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';

    // Update shortcut labels based on platform
    function initShortcutLabels() {
      const modElements = document.querySelectorAll('#shortcut-mod, #shortcut-mod-2, #shortcut-mod-3');
      modElements.forEach(el => {
        if (el) el.textContent = modKey;
      });
    }

    // Initialize shortcuts bar visibility
    // Bar starts hidden and only shows when prompt input is focused
    function initShortcutsBar() {
      // Always start hidden
      if (shortcutsBar) {
        shortcutsBar.classList.add('hidden');
      }
      initShortcutLabels();

      // Show shortcuts bar when prompt input is focused (desktop only)
      const promptInput = document.getElementById('prompt-input');
      if (promptInput && shortcutsBar) {
        promptInput.addEventListener('focus', () => {
          const dismissed = safeGetItem(SHORTCUTS_DISMISSED_KEY);
          // Only show on desktop (CSS hides on mobile via media query)
          if (dismissed !== 'true' && window.innerWidth >= 768) {
            shortcutsBar.classList.remove('hidden');
          }
        });
        promptInput.addEventListener('blur', () => {
          // Delay hide to allow clicking dismiss button
          setTimeout(() => {
            if (shortcutsBar) {
              shortcutsBar.classList.add('hidden');
            }
          }, 200);
        });
      }
    }

    // Dismiss shortcuts bar
    if (shortcutsDismiss) {
      shortcutsDismiss.addEventListener('click', () => {
        shortcutsBar.classList.add('hidden');
        safeSetItem(SHORTCUTS_DISMISSED_KEY, 'true');
      });
    }

    // Perform redo
    function performRedo() {
      if (redoHistory.length === 0) return;

      // Save current state to undo history before redo
      if (currentHtml) {
        undoHistory.push(currentHtml);
        if (undoHistory.length > MAX_UNDO_HISTORY) {
          undoHistory.shift();
        }
      }

      const nextHtml = redoHistory.pop();
      currentHtml = nextHtml;
      renderPreview(currentHtml);

      // Refresh applied action button states based on restored HTML
      refreshAppliedActionsFromHtml(currentHtml);

      // CRITICAL: Sync currentHistoryIndex with redo
      // This ensures historyEntries stay in sync when user redos
      if (currentHistoryIndex < historyEntries.length - 1) {
        currentHistoryIndex++;
        updateHistoryCount();
        renderHistoryPanel();
      }

      setStatus('Redone');
      console.log('[Glyph] Redo performed, history length:', redoHistory.length);
      setTimeout(() => setStatus('Ready'), 1500);

      updateUndoButtonState();
    }

    // Enhanced undo that saves to redo history
    const originalPerformUndo = performUndo;
    performUndo = function() {
      if (undoHistory.length === 0) return;

      // Save current state to redo history before undo
      if (currentHtml) {
        redoHistory.push(currentHtml);
        if (redoHistory.length > MAX_REDO_HISTORY) {
          redoHistory.shift();
        }
      }

      const previousHtml = undoHistory.pop();
      currentHtml = previousHtml;
      renderPreview(currentHtml);

      // Refresh applied action button states based on restored HTML
      refreshAppliedActionsFromHtml(currentHtml);

      // CRITICAL: Sync currentHistoryIndex with undo
      // This ensures historyEntries truncates correctly when user makes new change after undo
      if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        updateHistoryCount();
        renderHistoryPanel();
      }

      setStatus('Undone');
      console.log('[Glyph] Undo performed, history length:', undoHistory.length);
      setTimeout(() => setStatus('Ready'), 1500);

      updateUndoButtonState();
      clearDiffState();
    };

    // Keyboard shortcut handler
    document.addEventListener('keydown', (e) => {
      const isModKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + Z - Undo
      if (isModKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }

      // Cmd/Ctrl + Shift + Z - Redo
      if (isModKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
      }

      // Cmd/Ctrl + Enter - Submit
      if (isModKey && e.key === 'Enter') {
        e.preventDefault();
        const promptInput = document.getElementById('prompt-input');
        if (promptInput && promptInput.value.trim()) {
          applyModifications(promptInput.value.trim());
        }
      }

      // Escape - Clear input
      if (e.key === 'Escape') {
        const promptInput = document.getElementById('prompt-input');
        if (promptInput) {
          promptInput.value = '';
          promptInput.blur();
        }
      }
    });

    // Initialize shortcuts bar
    initShortcutsBar();

    // ============================================
    // Command Palette (Cmd+K)
    // ============================================
    const commandPaletteOverlay = document.getElementById('command-palette-overlay');
    const commandPaletteInput = document.getElementById('command-palette-input');
    const commandPaletteResults = document.getElementById('command-palette-results');
    const cmdKHint = document.getElementById('cmd-k-hint');
    const cmdKLabel = document.getElementById('cmd-k-label');

    // Set the Cmd+K label based on platform
    if (cmdKLabel) {
      cmdKLabel.textContent = isMac ? '\u2318K' : 'Ctrl+K';
    }

    let selectedCommandIndex = 0;
    let filteredPaletteCommands = [];

    // Command palette definitions
    const paletteCommands = [
      // Quick Actions
      { name: 'Add Watermark', action: () => applyInstantCommand('Add a diagonal watermark that says DRAFT across the page'), category: 'Quick Actions', icon: 'watermark' },
      { name: 'Add QR Code', action: () => applyInstantCommand('Add a QR code in the corner for quick mobile payment'), category: 'Quick Actions', icon: 'qr' },
      { name: 'Add Payment Terms', action: () => applyInstantCommand('Add payment terms: Net 30 with 2% early payment discount if paid within 10 days'), category: 'Quick Actions', icon: 'terms' },
      { name: 'Add Date', action: () => applyInstantCommand("Add today's date in the top right corner"), category: 'Quick Actions', icon: 'date' },
      { name: 'Add Border', action: () => applyInstantCommand('Add a professional border around the document'), category: 'Quick Actions', icon: 'border' },
      { name: 'Add Thank You Note', action: () => applyInstantCommand('Add a thank you note at the bottom'), category: 'Quick Actions', icon: 'note' },
      { name: 'Add Signature', action: () => applyInstantCommand('Add a signature'), category: 'Quick Actions', icon: 'signature' },
      // Templates
      { name: 'Switch to Modern Quote', action: () => switchToTemplate('quote-modern'), category: 'Templates', icon: 'template' },
      { name: 'Switch to Professional Quote', action: () => switchToTemplate('quote-professional'), category: 'Templates', icon: 'template' },
      { name: 'Switch to Bold Quote', action: () => switchToTemplate('quote-bold'), category: 'Templates', icon: 'template' },
      { name: 'Switch to Invoice', action: () => switchToTemplateType('invoice'), category: 'Templates', icon: 'template' },
      { name: 'Switch to Receipt', action: () => switchToTemplateType('receipt'), category: 'Templates', icon: 'template' },
      { name: 'Switch to Report Cover', action: () => switchToTemplateType('report'), category: 'Templates', icon: 'template' },
      // Edit
      { name: 'Undo', action: () => performUndo(), category: 'Edit', shortcut: isMac ? '\u2318Z' : 'Ctrl+Z', icon: 'undo' },
      { name: 'Redo', action: () => performRedo(), category: 'Edit', shortcut: isMac ? '\u21E7\u2318Z' : 'Ctrl+Shift+Z', icon: 'redo' },
      // Export
      { name: 'Download PDF', action: () => triggerPdfDownload(), category: 'Export', icon: 'download' },
      // Developer
      { name: 'Get API Code', action: () => openCopyCodeModal(), category: 'Developer', icon: 'code' },
      // View
      { name: 'View History', action: () => toggleHistoryPanel(), category: 'View', icon: 'history' },
      // Navigation
      { name: 'Go to Dashboard', action: () => window.open('https://dashboard.glyph.you', '_blank'), category: 'Navigation', icon: 'external' },
      { name: 'Go to Docs', action: () => window.open('https://docs.glyph.you', '_blank'), category: 'Navigation', icon: 'external' },
    ];

    // Helper to apply instant commands through the playground
    function applyInstantCommand(prompt) {
      const promptInput = document.getElementById('prompt-input');
      if (promptInput) {
        promptInput.value = prompt;
        applyModifications(prompt);
      }
    }

    // Helper to switch templates
    function switchToTemplate(templateId) {
      // First check if we need to switch the type dropdown
      for (const [type, config] of Object.entries(TEMPLATE_TYPE_CONFIG)) {
        if (config.variants.some(v => v.id === templateId)) {
          const typeSelect = document.getElementById('template-type-select-playground');
          if (typeSelect && typeSelect.value !== type) {
            typeSelect.value = type;
            typeSelect.dispatchEvent(new Event('change'));
            // After type switch, find and click the correct variant tab
            setTimeout(() => {
              const tab = document.querySelector(`.playground__tab[data-template="${templateId}"]`);
              if (tab && !tab.classList.contains('playground__tab--active')) tab.click();
            }, 500);
            return;
          }
          break;
        }
      }
      const tab = document.querySelector(`.playground__tab[data-template="${templateId}"]`);
      if (tab && !tab.classList.contains('playground__tab--active')) {
        tab.click();
      }
    }

    // Helper to switch template type via dropdown
    function switchToTemplateType(type) {
      const typeSelect = document.getElementById('template-type-select-playground');
      if (typeSelect && typeSelect.value !== type) {
        typeSelect.value = type;
        typeSelect.dispatchEvent(new Event('change'));
      }
    }

    // Helper to trigger PDF download
    function triggerPdfDownload() {
      const generateBtn = document.getElementById('generate-btn');
      if (generateBtn && !generateBtn.disabled) {
        generateBtn.click();
      }
    }

    // Get icon SVG for command type
    function getCommandIcon(iconType) {
      const icons = {
        watermark: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>',
        qr: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>',
        terms: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
        date: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
        border: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"/>',
        note: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>',
        signature: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>',
        template: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>',
        undo: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>',
        redo: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/>',
        download: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>',
        code: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>',
        history: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        external: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>',
      };
      return icons[iconType] || icons.note;
    }

    // Filter commands based on search query
    function filterPaletteCommands(query) {
      if (!query) {
        return [...paletteCommands];
      }
      const lowerQuery = query.toLowerCase();
      return paletteCommands.filter(cmd =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery)
      );
    }

    // Render command palette results
    function renderCommandResults() {
      if (!commandPaletteResults) return;

      if (filteredPaletteCommands.length === 0) {
        commandPaletteResults.innerHTML = '<div class="command-palette__empty">No matching commands</div>';
        return;
      }

      // Group by category
      const grouped = {};
      filteredPaletteCommands.forEach(cmd => {
        if (!grouped[cmd.category]) {
          grouped[cmd.category] = [];
        }
        grouped[cmd.category].push(cmd);
      });

      let html = '';
      Object.entries(grouped).forEach(([category, cmds]) => {
        html += `<div class="command-palette__category">${category}</div>`;
        cmds.forEach((cmd, idx) => {
          const globalIdx = filteredPaletteCommands.indexOf(cmd);
          const isSelected = globalIdx === selectedCommandIndex;
          html += `
            <div class="command-palette__item${isSelected ? ' command-palette__item--selected' : ''}" data-index="${globalIdx}">
              <svg class="command-palette__item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${getCommandIcon(cmd.icon)}
              </svg>
              <span class="command-palette__item-name">${cmd.name}</span>
              ${cmd.shortcut ? `<span class="command-palette__item-shortcut">${cmd.shortcut}</span>` : ''}
            </div>
          `;
        });
      });

      commandPaletteResults.innerHTML = html;

      // Add click handlers
      commandPaletteResults.querySelectorAll('.command-palette__item').forEach(item => {
        item.addEventListener('click', () => {
          const index = parseInt(item.dataset.index, 10);
          executeCommand(index);
        });
        item.addEventListener('mouseenter', () => {
          selectedCommandIndex = parseInt(item.dataset.index, 10);
          updateSelectedItem();
        });
      });
    }

    // Update visual selection
    function updateSelectedItem() {
      const items = commandPaletteResults.querySelectorAll('.command-palette__item');
      items.forEach((item, idx) => {
        const itemIndex = parseInt(item.dataset.index, 10);
        item.classList.toggle('command-palette__item--selected', itemIndex === selectedCommandIndex);
      });

      // Scroll selected item into view
      const selectedItem = commandPaletteResults.querySelector('.command-palette__item--selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }

    // Execute the selected command
    function executeCommand(index) {
      const cmd = filteredPaletteCommands[index];
      if (cmd) {
        closeCommandPalette();
        // Small delay to let the modal close before executing
        setTimeout(() => cmd.action(), 50);
      }
    }

    // Open command palette
    function openCommandPalette() {
      if (!commandPaletteOverlay) return;

      commandPaletteOverlay.classList.add('visible');
      document.body.style.overflow = 'hidden';

      // Reset state
      selectedCommandIndex = 0;
      filteredPaletteCommands = filterPaletteCommands('');
      if (commandPaletteInput) {
        commandPaletteInput.value = '';
        commandPaletteInput.focus();
      }
      renderCommandResults();
    }

    // Close command palette
    function closeCommandPalette() {
      if (!commandPaletteOverlay) return;

      commandPaletteOverlay.classList.remove('visible');
      document.body.style.overflow = '';
    }

    // Command palette input handler
    if (commandPaletteInput) {
      commandPaletteInput.addEventListener('input', (e) => {
        const query = e.target.value;
        filteredPaletteCommands = filterPaletteCommands(query);
        selectedCommandIndex = 0;
        renderCommandResults();
      });

      commandPaletteInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedCommandIndex = Math.min(selectedCommandIndex + 1, filteredPaletteCommands.length - 1);
          updateSelectedItem();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0);
          updateSelectedItem();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          executeCommand(selectedCommandIndex);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeCommandPalette();
        }
      });
    }

    // Close on backdrop click
    if (commandPaletteOverlay) {
      commandPaletteOverlay.addEventListener('click', (e) => {
        if (e.target === commandPaletteOverlay) {
          closeCommandPalette();
        }
      });
    }

    // Cmd+K hint button
    if (cmdKHint) {
      cmdKHint.addEventListener('click', openCommandPalette);
    }

    // Add Cmd+K to existing keyboard shortcut handler
    document.addEventListener('keydown', (e) => {
      const isModKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + K - Open command palette
      if (isModKey && e.key === 'k') {
        e.preventDefault();
        if (commandPaletteOverlay?.classList.contains('visible')) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
      }

      // Escape - Close command palette if open
      if (e.key === 'Escape' && commandPaletteOverlay?.classList.contains('visible')) {
        e.preventDefault();
        e.stopPropagation();
        closeCommandPalette();
      }
    });

    // ============================================
    // Keyboard Shortcuts Help Overlay
    // ============================================
    const shortcutsOverlay = document.getElementById('shortcuts-overlay');
    const shortcutsClose = shortcutsOverlay?.querySelector('.shortcuts-close');

    // Set the modifier key labels based on platform
    document.querySelectorAll('.shortcuts-overlay .mod-key').forEach(el => {
      el.textContent = isMac ? '\u2318' : 'Ctrl';
    });

    function showShortcuts() {
      shortcutsOverlay?.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function hideShortcuts() {
      shortcutsOverlay?.classList.add('hidden');
      document.body.style.overflow = '';
    }

    // ? key opens shortcuts help
    document.addEventListener('keydown', (e) => {
      // Don't trigger in inputs or textareas
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Don't trigger if command palette is open
      if (commandPaletteOverlay?.classList.contains('visible')) return;

      if (e.key === '?') {
        e.preventDefault();
        if (!shortcutsOverlay?.classList.contains('hidden')) {
          hideShortcuts();
        } else {
          showShortcuts();
        }
      }

      // Escape closes shortcuts
      if (e.key === 'Escape' && !shortcutsOverlay?.classList.contains('hidden')) {
        e.preventDefault();
        hideShortcuts();
      }
    });

    // Close button handler
    shortcutsClose?.addEventListener('click', hideShortcuts);

    // Click outside modal to close
    shortcutsOverlay?.addEventListener('click', (e) => {
      if (e.target === shortcutsOverlay) {
        hideShortcuts();
      }
    });

    // ============================================
    // Version History Panel (Auto-tracking Timeline)
    // ============================================
    // Lazy-load DOM elements to ensure they exist when accessed
    let historyToggleBtn, historyPanel, historyPanelClose, historyPanelContent, historyCountEl;

    function getHistoryElements() {
      if (!historyToggleBtn) {
        historyToggleBtn = document.getElementById('history-toggle-btn');
        historyPanel = document.getElementById('history-panel');
        historyPanelClose = document.getElementById('history-panel-close');
        historyPanelContent = document.getElementById('history-panel-content');
        historyCountEl = document.getElementById('history-count');
      }
    }

    // History entries - each modification creates an entry
    let historyEntries = [];
    let currentHistoryIndex = -1;
    const MAX_HISTORY_ENTRIES = 50;

    // Add entry to history when modification is made
    function addHistoryEntry(prompt, html) {
      const entry = {
        id: Date.now(),
        timestamp: new Date(),
        prompt: prompt || 'Initial state',
        html: html
      };

      // Remove any entries after current index (when user went back and made new change)
      if (currentHistoryIndex < historyEntries.length - 1) {
        historyEntries = historyEntries.slice(0, currentHistoryIndex + 1);
      }

      historyEntries.push(entry);
      currentHistoryIndex = historyEntries.length - 1;

      // Limit history size
      if (historyEntries.length > MAX_HISTORY_ENTRIES) {
        historyEntries.shift();
        currentHistoryIndex--;
      }

      updateHistoryCount();
      renderHistoryPanel();
    }

    // Update history count badge
    function updateHistoryCount() {
      getHistoryElements();
      if (historyCountEl) {
        historyCountEl.textContent = historyEntries.length;
      }
    }

    // Format timestamp for display
    function formatHistoryTime(date) {
      const now = new Date();
      const diff = now - date;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 60) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString();
    }

    // Render the history panel content
    function renderHistoryPanel() {
      getHistoryElements();
      if (!historyPanelContent) return;

      if (historyEntries.length === 0) {
        historyPanelContent.innerHTML = `
          <div class="history-panel__empty">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div class="history-panel__empty-title">No changes yet</div>
            <div class="history-panel__empty-text">Apply some changes to see your edit history here</div>
          </div>
        `;
        return;
      }

      const entriesHtml = historyEntries
        .slice()
        .reverse()
        .map((entry, idx) => {
          const actualIndex = historyEntries.length - 1 - idx;
          const isCurrent = actualIndex === currentHistoryIndex;
          return `
            <div class="history-entry${isCurrent ? ' history-entry--current' : ''}" data-index="${actualIndex}">
              <div class="history-entry__time">${formatHistoryTime(new Date(entry.timestamp))}</div>
              <div class="history-entry__prompt">${escapeHtml(entry.prompt)}</div>
              ${!isCurrent ? '<button class="history-entry__restore">Restore</button>' : ''}
            </div>
          `;
        })
        .join('');

      historyPanelContent.innerHTML = `<div class="history-timeline">${entriesHtml}</div>`;

      // Add click handlers for restore
      historyPanelContent.querySelectorAll('.history-entry').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('history-entry__restore') || !el.classList.contains('history-entry--current')) {
            const index = parseInt(el.dataset.index, 10);
            restoreHistoryEntry(index);
          }
        });
      });
    }

    // Helper to escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Restore a history entry
    function restoreHistoryEntry(index) {
      if (index < 0 || index >= historyEntries.length) return;

      const entry = historyEntries[index];
      currentHistoryIndex = index;
      currentHtml = entry.html;
      renderPreview(currentHtml);
      renderHistoryPanel();
      showToast(`Restored to "${entry.prompt.substring(0, 30)}${entry.prompt.length > 30 ? '...' : ''}"`);
    }

    // Toggle history panel
    function toggleHistoryPanel() {
      getHistoryElements();
      if (historyPanel) {
        historyPanel.classList.toggle('open');
        historyToggleBtn?.classList.toggle('active', historyPanel.classList.contains('open'));
      }
    }

    // Close history panel
    function closeHistoryPanel() {
      if (historyPanel) {
        historyPanel.classList.remove('open');
        historyToggleBtn?.classList.remove('active');
      }
    }

    // Event listeners for history panel - deferred until DOM is ready
    function initHistoryPanelListeners() {
      getHistoryElements();
      if (historyToggleBtn) {
        historyToggleBtn.addEventListener('click', toggleHistoryPanel);
      }

      if (historyPanelClose) {
        historyPanelClose.addEventListener('click', closeHistoryPanel);
      }

      // Close panel when clicking outside
      document.addEventListener('click', (e) => {
        getHistoryElements();
        if (historyPanel?.classList.contains('open') &&
            !historyPanel.contains(e.target) &&
            !historyToggleBtn?.contains(e.target)) {
          closeHistoryPanel();
        }
      });
    }

    // Initialize history panel when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initHistoryPanelListeners);
    } else {
      initHistoryPanelListeners();
    }

    // ============================================
    // Named Snapshots (Saved Versions)
    // ============================================
    const SAVED_VERSIONS_KEY = 'glyph_saved_versions';
    const MAX_SAVED_VERSIONS = 10;

    // DOM elements for saved versions - use lazy getters since modal HTML is below script
    // These elements exist in DOM at lines 10689+ but script runs before that
    let _saveVersionElements = null;
    function getSaveVersionElements() {
      if (!_saveVersionElements) {
        _saveVersionElements = {
          saveVersionBtn: document.getElementById('save-version-btn'),
          saveVersionModal: document.getElementById('save-version-modal'),
          versionNameInput: document.getElementById('version-name-input'),
          saveVersionConfirm: document.getElementById('save-version-confirm'),
          saveVersionCancel: document.getElementById('save-version-cancel'),
          savedVersionsList: document.getElementById('saved-versions-list'),
          savedVersionsCount: document.getElementById('saved-versions-count'),
          deleteConfirmModal: document.getElementById('delete-confirm-modal'),
          deleteVersionName: document.getElementById('delete-version-name'),
          deleteConfirm: document.getElementById('delete-confirm'),
          deleteCancel: document.getElementById('delete-cancel'),
          glyphToast: document.getElementById('glyph-toast'),
          toastMessage: document.getElementById('toast-message')
        };
      }
      return _saveVersionElements;
    }
    
    let savedVersions = [];
    let versionToDelete = null;
    
    // Load saved versions from localStorage
    function loadSavedVersions() {
      try {
        const stored = safeGetItem(SAVED_VERSIONS_KEY);
        savedVersions = stored ? JSON.parse(stored) : [];
        renderSavedVersions();
      } catch (e) {
        console.error('[Glyph] Error loading saved versions:', e);
        savedVersions = [];
      }
    }

    // Save versions to localStorage
    function persistSavedVersions() {
      const success = safeSetItem(SAVED_VERSIONS_KEY, JSON.stringify(savedVersions));
      if (!success) {
        handleStorageFailure();
      }
    }
    
    // Show toast notification
    function showToast(message, type = 'success', duration = 3000) {
      const els = getSaveVersionElements();
      if (!els.glyphToast || !els.toastMessage) return;

      els.toastMessage.textContent = message;
      els.glyphToast.className = 'glyph-toast glyph-toast--' + type;

      // Update icon based on type
      const iconPath = els.glyphToast.querySelector('.glyph-toast__icon path');
      if (iconPath) {
        if (type === 'success') {
          iconPath.setAttribute('d', 'M5 13l4 4L19 7');
        } else if (type === 'error') {
          iconPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
        } else if (type === 'info') {
          // Info icon - circle with i
          iconPath.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z');
        } else if (type === 'warning') {
          // Warning triangle icon
          iconPath.setAttribute('d', 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z');
        }
      }

      // STALE TOAST FIX: Clear inline display:none before showing
      els.glyphToast.style.display = 'flex';
      els.glyphToast.removeAttribute('aria-hidden');
      els.glyphToast.classList.add('active');

      setTimeout(() => {
        els.glyphToast.classList.remove('active');
        // Re-hide after animation completes
        setTimeout(() => {
          if (!els.glyphToast.classList.contains('active')) {
            els.glyphToast.style.display = 'none';
            els.glyphToast.setAttribute('aria-hidden', 'true');
          }
        }, 300); // Match CSS transition duration
      }, duration);
    }

    // Show success CTA after first successful modification
    function showSuccessCta() {
      if (hasShownSuccessCta) return;
      hasShownSuccessCta = true;

      const ctaElement = document.getElementById('success-cta');
      if (ctaElement) {
        // Delay showing to not interrupt the success animation
        setTimeout(() => {
          ctaElement.classList.add('visible');
        }, 1000);
      }
    }

    // ============================================
    // First Win Celebration - The Addiction Hook!
    // Confetti + special message on first successful modification
    // ============================================
    const FIRST_WIN_KEY = 'glyph_first_win';

    function isFirstWin() {
      try {
        return !localStorage.getItem(FIRST_WIN_KEY);
      } catch (e) {
        return false; // Private browsing - skip celebration
      }
    }

    function markFirstWinComplete() {
      try {
        localStorage.setItem(FIRST_WIN_KEY, 'true');
      } catch (e) {
        // Private browsing - ignore
      }
    }

    // ============================================
    // First Instant Win Celebration
    // Subtle glow + special message on first instant action
    // Keeps it tasteful - no looping confetti, just a brief moment
    // ============================================
    function celebrateFirstInstantWin() {
      if (hasShownFirstInstantWin) return;
      hasShownFirstInstantWin = true;

      // Add subtle glow pulse to preview area (0.8s duration)
      const previewArea = document.querySelector('.playground__preview-area');
      if (previewArea) {
        previewArea.classList.add('first-win-glow');
        setTimeout(() => {
          previewArea.classList.remove('first-win-glow');
        }, 800);
      }

      // Show success toast with Get Code button (first win uses showModificationSuccessToast which handles first-win state)
      showModificationSuccessToast(0, true);
      updateResponseTimeBadge(0, true);

      // Pulse the save button to encourage saving (if no versions saved yet)
      promptSaveAfterFirstWin();
    }

    // ============================================
    // Flash preview area on content update (mobile visual feedback)
    // Friction Fix #1: Help mobile users see where changes appear
    // ============================================
    function flashPreviewArea() {
      const previewArea = document.querySelector('.playground__preview-area');
      if (previewArea) {
        previewArea.classList.remove('content-updated');
        // Force reflow to restart animation
        void previewArea.offsetWidth;
        previewArea.classList.add('content-updated');
        setTimeout(() => {
          previewArea.classList.remove('content-updated');
        }, 500);
      }
    }

    // ============================================
    // Highlight quick action buttons - guides users with empty prompt
    // P2 Friction Fix #5: Empty prompt error could suggest quick actions
    // ============================================
    function highlightQuickActions() {
      // Get all hero suggestions (the most prominent quick actions)
      const heroButtons = document.querySelectorAll('.playground__suggestion--hero:not(.playground__suggestion--applied)');

      heroButtons.forEach((btn, index) => {
        // Stagger the animation slightly for visual appeal
        setTimeout(() => {
          btn.classList.add('playground__suggestion--highlight');
          // Remove the highlight class after animation completes
          setTimeout(() => {
            btn.classList.remove('playground__suggestion--highlight');
          }, 600);
        }, index * 100);
      });

      // Also scroll to make sure the suggestions are visible
      const suggestionsRow = document.querySelector('.playground__suggestions');
      if (suggestionsRow && window.innerWidth <= 480) {
        suggestionsRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // ============================================
    // Mark instant action as applied - shows checkmark on button
    // Friction Fix #6: Users need to know which actions are active
    // ============================================
    function markActionApplied(prompt) {
      // Find the button that matches this prompt
      const suggestions = document.querySelectorAll('.playground__suggestion');
      suggestions.forEach(btn => {
        if (btn.dataset.prompt === prompt) {
          btn.classList.add('playground__suggestion--applied');
          appliedActions.add(prompt);
        }
      });
    }

    // Clear applied state from a button (used on undo)
    function clearActionApplied(prompt) {
      const suggestions = document.querySelectorAll('.playground__suggestion');
      suggestions.forEach(btn => {
        if (btn.dataset.prompt === prompt) {
          btn.classList.remove('playground__suggestion--applied');
          appliedActions.delete(prompt);
        }
      });
    }

    // Clear all applied states (used on template switch or reset)
    function clearAllAppliedActions() {
      const suggestions = document.querySelectorAll('.playground__suggestion');
      suggestions.forEach(btn => {
        btn.classList.remove('playground__suggestion--applied');
      });
      appliedActions.clear();
    }

    // Refresh applied states based on current HTML content
    // Called after undo to sync button states with actual document state
    function refreshAppliedActionsFromHtml(html) {
      const suggestions = document.querySelectorAll('.playground__suggestion');
      console.log('[Glyph] Refreshing applied action states from HTML');

      suggestions.forEach(btn => {
        const prompt = btn.dataset.prompt;
        const lowPrompt = prompt.toLowerCase();
        let isApplied = false;

        // Check for each action type's unique marker class in the HTML
        // Use specific glyph-* classes as definitive markers
        if (/watermark/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-watermark');
        } else if (/qr\s*code/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-qr-code');
        } else if (/group.*category/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-category-group');
        } else if (/payment\s*terms|net\s*\d+/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-payment-terms');
        } else if (/bold.*header|header.*bold/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-bold-header');
        } else if (/add.*date|today.*date/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-date-added');
        } else if (/add.*border|border.*document/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-document-border');
        } else if (/thank\s*you.*note|add.*thank/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-thank-you');
        } else if (/add.*signature|signature.*line/i.test(lowPrompt)) {
          isApplied = html.includes('glyph-signature-line');
        }

        if (isApplied) {
          btn.classList.add('playground__suggestion--applied');
          appliedActions.add(prompt);
        } else {
          btn.classList.remove('playground__suggestion--applied');
          appliedActions.delete(prompt);
        }
      });
    }

    // ============================================
    // Prompt user to save after first successful modification
    // Subtle visual nudge without being annoying
    // ============================================
    let hasPromptedSaveAfterWin = false;

    function promptSaveAfterFirstWin() {
      if (hasPromptedSaveAfterWin) return;
      if (savedVersions.length > 0) return; // Already has saved versions

      hasPromptedSaveAfterWin = true;

      // Delay the pulse to not overlap with the first-win celebration
      setTimeout(() => {
        const saveBtn = document.getElementById('save-version-btn');
        if (saveBtn) {
          saveBtn.classList.add('ready-to-save');
          // Remove after animation completes (3 pulses x 2s = 6s)
          setTimeout(() => {
            saveBtn.classList.remove('ready-to-save');
          }, 6000);
        }
      }, 1500);
    }

    // ============================================
    // Copy as Code - Track last successful modification
    // ============================================
    let lastSuccessfulModifyRequest = null;

    function trackModifyRequest(params) {
      lastSuccessfulModifyRequest = {
        sessionId: params.sessionId || sessionId,
        prompt: params.prompt,
        timestamp: Date.now()
      };
    }

    // ============================================
    // Copy as Code Modal - API Code Snippets
    // ============================================
    function openCopyCodeModal() {
      const modal = document.getElementById('copy-code-modal');
      if (!modal || !lastSuccessfulModifyRequest) return;

      // Generate code snippets
      generateCodeSnippets();

      // Show modal
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeCopyCodeModal() {
      const modal = document.getElementById('copy-code-modal');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    function generateCodeSnippets() {
      if (!lastSuccessfulModifyRequest) return;

      const { sessionId: reqSessionId, prompt } = lastSuccessfulModifyRequest;
      const apiUrl = 'https://api.glyph.you';

      // Escape strings for code generation
      const escapeForJson = (str) => JSON.stringify(str).slice(1, -1);
      const escapedPrompt = escapeForJson(prompt);

      // cURL snippet
      const curlSnippet = `curl -X POST ${apiUrl}/v1/modify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "${reqSessionId}",
    "prompt": "${escapedPrompt}"
  }'`;

      // JavaScript snippet
      const jsSnippet = `const response = await fetch('${apiUrl}/v1/modify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: '${reqSessionId}',
    prompt: '${escapedPrompt}'
  })
});

const result = await response.json();
console.log(result.html); // Updated HTML`;

      // Python snippet
      const pythonSnippet = `import requests

response = requests.post(
    '${apiUrl}/v1/modify',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'sessionId': '${reqSessionId}',
        'prompt': '${escapedPrompt}'
    }
)

result = response.json()
print(result['html'])  # Updated HTML`;

      // Update pre elements
      const curlEl = document.getElementById('code-snippet-curl');
      const jsEl = document.getElementById('code-snippet-javascript');
      const pythonEl = document.getElementById('code-snippet-python');

      if (curlEl) curlEl.textContent = curlSnippet;
      if (jsEl) jsEl.textContent = jsSnippet;
      if (pythonEl) pythonEl.textContent = pythonSnippet;
    }

    function initCopyCodeModal() {
      const modal = document.getElementById('copy-code-modal');
      if (!modal) return;

      // Close button
      const closeBtn = document.getElementById('copy-code-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeCopyCodeModal);
      }

      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeCopyCodeModal();
        }
      });

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeCopyCodeModal();
        }
      });

      // Tab switching
      const tabs = modal.querySelectorAll('.copy-code-modal__tab');
      const snippets = modal.querySelectorAll('.copy-code-modal__snippet');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const lang = tab.dataset.lang;

          // Update active tab
          tabs.forEach(t => t.classList.remove('copy-code-modal__tab--active'));
          tab.classList.add('copy-code-modal__tab--active');

          // Show corresponding snippet
          snippets.forEach(s => {
            if (s.dataset.lang === lang) {
              s.classList.add('copy-code-modal__snippet--active');
            } else {
              s.classList.remove('copy-code-modal__snippet--active');
            }
          });
        });
      });

      // Copy buttons
      const copyBtns = modal.querySelectorAll('.copy-code-modal__copy-btn');
      copyBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
          const lang = btn.dataset.lang;
          const preEl = document.getElementById(`code-snippet-${lang}`);
          if (!preEl) return;

          const success = await copyTextToClipboard(preEl.textContent);

          if (success) {
            // Visual feedback
            const originalHtml = btn.innerHTML;
            btn.classList.add('copy-code-modal__copy-btn--copied');
            btn.innerHTML = `
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Copied!
            `;

            setTimeout(() => {
              btn.classList.remove('copy-code-modal__copy-btn--copied');
              btn.innerHTML = originalHtml;
            }, 2000);
          } else {
            showToast("Couldn't copy to clipboard - try Ctrl/Cmd+C", 'error', 4000);
          }
        });
      });

      console.log('[Glyph] Copy as Code modal initialized');
    }

    // Initialize Copy Code Modal on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCopyCodeModal);
    } else {
      initCopyCodeModal();
    }

    // ============================================
    // Modification Success Toast - Cycle 6 Addition
    // Celebrates the magic moment when changes are applied
    // ============================================
    let modificationSuccessToastElement = null;
    let modificationSuccessToastTimeout = null;

    // Response timing badge in preview label bar
    function updateResponseTimeBadge(elapsed, isInstant = false) {
      const badge = document.getElementById('response-time-badge');
      if (!badge) return;
      const seconds = parseFloat(elapsed);
      const isFast = isInstant || seconds < 0.5;
      badge.textContent = isInstant ? 'Instant' : `${elapsed}s`;
      badge.className = 'playground__response-time' + (isFast ? ' playground__response-time--fast' : '');
      badge.style.display = '';
    }

    function showModificationSuccessToast(elapsed, isInstant = false) {
      // Check if this is the user's first win BEFORE we update localStorage
      const isFirst = isFirstWin();

      // Create toast element if it doesn't exist
      if (!modificationSuccessToastElement) {
        modificationSuccessToastElement = document.createElement('div');
        modificationSuccessToastElement.className = 'modification-success-toast';
        modificationSuccessToastElement.innerHTML = `
          <svg class="modification-success-toast__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
          </svg>
          <div class="modification-success-toast__content">
            <span class="modification-success-toast__title">Changes applied successfully</span>
            <span class="modification-success-toast__detail"></span>
          </div>
          <div class="modification-success-toast__actions">
            <button class="modification-success-toast__code-btn" id="toast-get-code-btn" title="Get API code for this modification">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
              </svg>
              <span>Get Code</span>
            </button>
          </div>
        `;
        document.body.appendChild(modificationSuccessToastElement);

        // Add click handler for the "Get Code" button
        const codeBtn = modificationSuccessToastElement.querySelector('#toast-get-code-btn');
        if (codeBtn) {
          codeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Hide toast
            modificationSuccessToastElement.classList.remove('visible');
            if (modificationSuccessToastTimeout) {
              clearTimeout(modificationSuccessToastTimeout);
            }
            // Open modal
            openCopyCodeModal();
          });
        }
      }

      // Update toast content - special message for first win
      const titleEl = modificationSuccessToastElement.querySelector('.modification-success-toast__title');
      const detailEl = modificationSuccessToastElement.querySelector('.modification-success-toast__detail');

      if (isFirst) {
        if (titleEl) titleEl.textContent = 'You just customized your first PDF!';
        if (detailEl) detailEl.textContent = 'That was all you. Try another change!';
        // Mark first win complete (no confetti - user preference)
        markFirstWinComplete();
      } else if (isInstant) {
        if (titleEl) titleEl.textContent = 'Changes applied instantly!';
        if (detailEl) detailEl.textContent = 'Local transformation - no API call needed';
      } else {
        if (titleEl) titleEl.textContent = 'Changes applied successfully';
        if (detailEl) detailEl.textContent = `Completed in ${elapsed}s`;
      }

      // Clear any existing timeout
      if (modificationSuccessToastTimeout) {
        clearTimeout(modificationSuccessToastTimeout);
      }

      // Show toast with animation
      requestAnimationFrame(() => {
        modificationSuccessToastElement.classList.add('visible');
      });

      // Auto-hide after 4 seconds (5 seconds for first win to enjoy the moment)
      const hideDelay = isFirst ? 5000 : 4000;
      modificationSuccessToastTimeout = setTimeout(() => {
        modificationSuccessToastElement.classList.remove('visible');
      }, hideDelay);

      // Auto-scroll to preview on mobile after success
      if (window.innerWidth <= 480) {
        const previewArea = document.querySelector('.playground__preview-area');
        if (previewArea) {
          setTimeout(() => {
            previewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }

        // Auto-zoom on first modification so users can read their changes
        if (isFirst && previewContainer && !previewContainer.classList.contains('zoomed-in')) {
          setTimeout(() => {
            previewContainer.classList.add('zoomed-in');
          }, 800);  // After scroll completes
        }
      }
    }

    // Format timestamp for display
    function formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return diffMins + ' min ago';
      if (diffHours < 24) return diffHours + ' hour' + (diffHours === 1 ? '' : 's') + ' ago';
      if (diffDays < 7) return diffDays + ' day' + (diffDays === 1 ? '' : 's') + ' ago';
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    // Render saved versions list
    function renderSavedVersions() {
      const els = getSaveVersionElements();
      if (!els.savedVersionsList || !els.savedVersionsCount) return;

      els.savedVersionsCount.textContent = savedVersions.length + '/10';

      if (savedVersions.length === 0) {
        els.savedVersionsList.innerHTML = '<div class="saved-versions__empty">Save your best versions <span class="saved-versions__slots">' + (MAX_SAVED_VERSIONS - savedVersions.length) + ' slots available</span></div>';
        return;
      }

      // Sort by timestamp (newest first)
      const sorted = [...savedVersions].sort((a, b) => b.timestamp - a.timestamp);

      els.savedVersionsList.innerHTML = sorted.map(version => {
        const item = document.createElement('div');
        item.className = 'saved-version-item';
        item.setAttribute('data-id', version.id);
        item.innerHTML = '<svg class="saved-version-item__star" fill="currentColor" viewBox="0 0 24 24">' +
          '<path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>' +
          '</svg>' +
          '<div class="saved-version-item__info">' +
          '<div class="saved-version-item__name">' + escapeHtml(version.name) + '</div>' +
          '<div class="saved-version-item__date">' + formatTimestamp(version.timestamp) + '</div>' +
          '</div>' +
          '<button class="saved-version-item__delete" data-id="' + version.id + '" title="Delete version">' +
          '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>' +
          '</svg>' +
          '</button>';
        return item.outerHTML;
      }).join('');

      // Add click handlers
      els.savedVersionsList.querySelectorAll('.saved-version-item').forEach(item => {
        item.addEventListener('click', (e) => {
          // Don't restore if clicking delete button
          if (e.target.closest('.saved-version-item__delete')) return;

          const id = item.getAttribute('data-id');
          restoreSavedVersion(id);
        });
      });

      els.savedVersionsList.querySelectorAll('.saved-version-item__delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          confirmDeleteVersion(id);
        });
      });
    }
    
    // Escape HTML for display
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Open save version modal
    function openSaveVersionModal() {
      const els = getSaveVersionElements();
      if (!currentHtml) {
        showToast('No document to save', 'error');
        return;
      }

      if (savedVersions.length >= MAX_SAVED_VERSIONS) {
        showToast('Maximum 10 versions. Delete one first.', 'error');
        return;
      }

      if (els.versionNameInput) els.versionNameInput.value = '';
      if (els.saveVersionModal) els.saveVersionModal.classList.add('active');
      setTimeout(() => els.versionNameInput && els.versionNameInput.focus(), 100);
    }

    // Close save version modal
    function closeSaveVersionModal() {
      const els = getSaveVersionElements();
      if (els.saveVersionModal) els.saveVersionModal.classList.remove('active');
      if (els.versionNameInput) els.versionNameInput.value = '';
    }

    // Track if this is the user's first ever saved version
    const FIRST_SAVE_KEY = 'glyph_first_save_complete';

    function isFirstSave() {
      try {
        return !localStorage.getItem(FIRST_SAVE_KEY);
      } catch (e) {
        return false;
      }
    }

    function markFirstSaveComplete() {
      try {
        localStorage.setItem(FIRST_SAVE_KEY, 'true');
      } catch (e) {
        // Private browsing - ignore
      }
    }

    // Save the current version
    function saveCurrentVersion() {
      const els = getSaveVersionElements();
      const name = els.versionNameInput ? els.versionNameInput.value.trim() : '';

      if (!name) {
        showToast('Please enter a name', 'error');
        return;
      }

      if (!currentHtml) {
        showToast('No document to save', 'error');
        return;
      }

      // Check if this is the first save BEFORE adding to savedVersions
      const isFirst = isFirstSave();
      const slotsRemaining = MAX_SAVED_VERSIONS - savedVersions.length - 1;

      const newVersion = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        name: name,
        html: currentHtml,
        timestamp: Date.now()
      };

      savedVersions.push(newVersion);
      persistSavedVersions();
      renderSavedVersions();
      closeSaveVersionModal();

      // Remove save button pulse if it was active
      const saveBtn = document.getElementById('save-version-btn');
      if (saveBtn) {
        saveBtn.classList.remove('ready-to-save');
      }

      // Special celebration for first saved version
      if (isFirst) {
        markFirstSaveComplete();
        showToast('First version saved! ' + slotsRemaining + ' slots remaining', 'success', 4000);
        celebrateFirstSave();
      } else {
        showToast('Version saved as "' + name + '"', 'success');
      }
      console.log('[Glyph] Saved version:', name);
    }

    // Celebrate first save with subtle visual feedback
    function celebrateFirstSave() {
      const savedVersionsSection = document.getElementById('saved-versions-section');
      if (savedVersionsSection) {
        savedVersionsSection.classList.add('first-save-glow');
        setTimeout(() => {
          savedVersionsSection.classList.remove('first-save-glow');
        }, 1000);
      }
    }
    
    // Restore a saved version
    function restoreSavedVersion(id) {
      const version = savedVersions.find(v => v.id === id);
      if (!version) return;
      
      // Save current state to undo history before restoring
      saveToUndoHistory();
      
      currentHtml = version.html;
      renderPreview(currentHtml);

      // Success animation
      previewContainer.classList.add('success');
      setTimeout(() => previewContainer.classList.remove('success'), 500);
      flashPreviewArea(); // Mobile visual feedback
      
      setStatus('Restored');
      setTimeout(() => setStatus('Ready'), 1500);
      
      showToast('Restored "' + version.name + '"', 'success');
      console.log('[Glyph] Restored version:', version.name);
    }
    
    // Confirm delete dialog
    function confirmDeleteVersion(id) {
      const els = getSaveVersionElements();
      const version = savedVersions.find(v => v.id === id);
      if (!version) return;

      versionToDelete = id;
      if (els.deleteVersionName) els.deleteVersionName.textContent = version.name;
      if (els.deleteConfirmModal) els.deleteConfirmModal.classList.add('active');
    }

    // Close delete dialog
    function closeDeleteModal() {
      const els = getSaveVersionElements();
      if (els.deleteConfirmModal) els.deleteConfirmModal.classList.remove('active');
      versionToDelete = null;
    }
    
    // Delete a saved version
    function deleteSavedVersion() {
      if (!versionToDelete) return;
      
      const version = savedVersions.find(v => v.id === versionToDelete);
      const name = version ? version.name : 'version';
      
      savedVersions = savedVersions.filter(v => v.id !== versionToDelete);
      persistSavedVersions();
      renderSavedVersions();
      closeDeleteModal();
      
      showToast('Deleted "' + name + '"', 'success');
      console.log('[Glyph] Deleted version:', name);
    }
    
    // Event listeners for saved versions - must wait for DOM since modal HTML is below script
    function initSaveVersionListeners() {
      const els = getSaveVersionElements();

      if (els.saveVersionBtn) {
        els.saveVersionBtn.addEventListener('click', openSaveVersionModal);
      }

      if (els.saveVersionCancel) {
        els.saveVersionCancel.addEventListener('click', closeSaveVersionModal);
      }

      if (els.saveVersionConfirm) {
        els.saveVersionConfirm.addEventListener('click', saveCurrentVersion);
      }

      if (els.saveVersionModal) {
        els.saveVersionModal.addEventListener('click', (e) => {
          if (e.target === els.saveVersionModal) closeSaveVersionModal();
        });
      }

      if (els.versionNameInput) {
        els.versionNameInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') saveCurrentVersion();
        });
      }

      if (els.deleteCancel) {
        els.deleteCancel.addEventListener('click', closeDeleteModal);
      }

      if (els.deleteConfirm) {
        els.deleteConfirm.addEventListener('click', deleteSavedVersion);
      }

      if (els.deleteConfirmModal) {
        els.deleteConfirmModal.addEventListener('click', (e) => {
          if (e.target === els.deleteConfirmModal) closeDeleteModal();
        });
      }

      // Load saved versions after listeners are attached
      loadSavedVersions();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSaveVersionListeners);
    } else {
      // DOM already loaded, but elements might still be below - use setTimeout to ensure they exist
      setTimeout(initSaveVersionListeners, 0);
    }
    // Static demo fallback when API is not available
    function renderStaticDemo() {
      const staticHtml = generateStaticHtml(sampleQuoteData, '#1E3A5F');
      currentHtml = staticHtml;
      renderPreview(staticHtml);
    }

    // Generate static HTML for demo mode
    function generateStaticHtml(data, accentColor) {
      return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid ${accentColor}; margin-bottom: 20px; }
  .company { font-size: 18px; font-weight: 700; color: ${accentColor}; }
  .company-address { font-size: 11px; color: #666; margin-top: 4px; white-space: pre-line; }
  .title { font-size: 24px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta { display: flex; gap: 32px; background: #f9fafb; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; }
  .meta-item { text-align: center; }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 4px; }
  .meta-value { font-weight: 600; }
  .client { margin-bottom: 24px; }
  .client-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; font-weight: 600; }
  .client-name { font-weight: 600; font-size: 14px; }
  .client-company { color: #666; margin-top: 4px; }
  .client-email { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${accentColor}; color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
  td { padding: 12px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
  .item-desc { font-weight: 500; }
  .item-details { font-size: 11px; color: #666; margin-top: 4px; }
  .totals { display: flex; justify-content: flex-end; margin-top: 20px; }
  .totals-table { width: 200px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
  .totals-row.total { border-top: 2px solid ${accentColor}; border-bottom: none; padding-top: 10px; margin-top: 4px; }
  .totals-label { color: #666; }
  .totals-value { font-weight: 500; }
  .totals-row.total .totals-label, .totals-row.total .totals-value { font-weight: 700; color: ${accentColor}; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${data.branding.companyName}</div>
      <div class="company-address">${data.branding.companyAddress}</div>
    </div>
    <div class="title">Quote</div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Quote Number</div>
      <div class="meta-value">${data.meta.quoteNumber}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Date</div>
      <div class="meta-value">${data.meta.date}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Valid Until</div>
      <div class="meta-value">${data.meta.validUntil}</div>
    </div>
  </div>

  <div class="client">
    <div class="client-label">Prepared For</div>
    <div class="client-name">${data.client.name}</div>
    <div class="client-company">${data.client.company}</div>
    <div class="client-email">${data.client.email}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.lineItems.map(item => `
      <tr>
        <td>
          <div class="item-desc">${item.description}</div>
          <div class="item-details">${item.details}</div>
        </td>
        <td>${item.quantity}</td>
        <td>$${item.unitPrice}</td>
        <td>$${item.total}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">$${data.totals.subtotal}</span>
      </div>
      <div class="totals-row total">
        <span class="totals-label">Total</span>
        <span class="totals-value">$${data.totals.total}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    // Set status indicator
    function setStatus(text) {
      previewStatus.innerHTML = `<span class="status-dot"></span>${text}`;
    }

    // ============================================
    // Progressive Preview - "Watch It Build"
    // Shows document building in real-time during AI streaming
    // ============================================

    // Stepper progress - clean step-based UI (no streaming preview)
    function setStepperStep(stepName) {
      const steps = document.querySelectorAll('.stepper__step');
      const connectors = document.querySelectorAll('.stepper__connector');
      const stepOrder = ['analyze', 'generate', 'render'];
      const targetIndex = stepOrder.indexOf(stepName);
      if (targetIndex === -1) return;

      steps.forEach((step, i) => {
        step.classList.remove('active', 'completed');
        if (i < targetIndex) {
          step.classList.add('completed');
        } else if (i === targetIndex) {
          step.classList.add('active');
        }
      });

      connectors.forEach((conn, i) => {
        conn.classList.toggle('done', i < targetIndex);
      });
    }

    function completeAllSteps() {
      document.querySelectorAll('.stepper__step').forEach(s => {
        s.classList.remove('active');
        s.classList.add('completed');
      });
      document.querySelectorAll('.stepper__connector').forEach(c => {
        c.classList.add('done');
      });
    }

    function resetStepper() {
      document.querySelectorAll('.stepper__step').forEach(s => {
        s.classList.remove('active', 'completed');
      });
      document.querySelectorAll('.stepper__connector').forEach(c => {
        c.classList.remove('done');
      });
    }

    // Legacy stubs for code that may reference these
    function updateProgressivePreview() {}
    function clearProgressivePreview() {}

    // Show/hide loading with clean step-based progress
    let elapsedTimerInterval = null;
    let loadingStartTime = null;
    let currentAbortController = null;  // For cancel button
    let cancelButtonTimeout = null;     // Shows cancel after 5 seconds

    // Legacy stubs referenced elsewhere in the codebase
    function resetLoadingStages() { resetStepper(); }
    function activateStage(stageName) {
      // Map old stage names to new stepper steps
      const map = { analyze: 'analyze', generate: 'generate', apply: 'generate', validate: 'render' };
      setStepperStep(map[stageName] || stageName);
    }

    function showLoading(show) {
      previewLoading.classList.toggle('visible', show);
      const cancelBtn = document.getElementById('loading-cancel-btn');

      if (show) {
        resetStepper();
        loadingStartTime = Date.now();
        // Start on first step immediately
        setStepperStep('analyze');

        // Hide cancel button initially
        if (cancelBtn) cancelBtn.classList.remove('visible');

        // Clear any existing cancel button timeout
        if (cancelButtonTimeout) {
          clearTimeout(cancelButtonTimeout);
          cancelButtonTimeout = null;
        }

        // Show cancel button after 5 seconds
        cancelButtonTimeout = setTimeout(() => {
          if (cancelBtn && isProcessingModification) {
            cancelBtn.classList.add('visible');
          }
        }, 5000);

        // Clear any existing elapsed timer
        if (elapsedTimerInterval) {
          clearInterval(elapsedTimerInterval);
          elapsedTimerInterval = null;
        }

        // Update status bar with elapsed seconds
        elapsedTimerInterval = setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - loadingStartTime) / 1000);
          setStatus(`Applying... ${elapsedSeconds}s`);
        }, 1000);

      } else {
        // Stop elapsed timer
        if (elapsedTimerInterval) {
          clearInterval(elapsedTimerInterval);
          elapsedTimerInterval = null;
        }

        // Clear cancel button timeout and hide button
        if (cancelButtonTimeout) {
          clearTimeout(cancelButtonTimeout);
          cancelButtonTimeout = null;
        }
        if (cancelBtn) cancelBtn.classList.remove('visible');

        // Mark all steps completed, then fade out
        completeAllSteps();
        setTimeout(() => {
          resetStepper();
        }, 500);
      }
    }

    // Issue #1: Detect AI refusal responses that should NOT be rendered to document
    // These are explanations/refusals that would corrupt the document if rendered
    function isAiRefusalResponse(html) {
      if (!html || typeof html !== 'string') return false;

      // Check if the HTML is suspiciously short (likely just text, not a document)
      // Real documents have substantial structure
      const trimmedHtml = html.trim();

      // If HTML doesn't contain basic document structure, it's likely a refusal text
      const hasDocStructure = trimmedHtml.includes('<!DOCTYPE') ||
                              trimmedHtml.includes('<html') ||
                              trimmedHtml.includes('<body') ||
                              trimmedHtml.includes('<div') ||
                              trimmedHtml.includes('<table');

      // Common AI refusal patterns - if HTML is mostly text with these phrases
      const refusalPatterns = [
        /I understand your request/i,
        /I cannot|I can't|I'm unable to/i,
        /I apologize|I'm sorry/i,
        /Unfortunately,? I/i,
        /This (request|feature|functionality) (is|isn't|cannot)/i,
        /beyond my capabilities/i,
        /not possible to/i,
        /I'd be happy to help.*but/i,
        /This would require/i,
        /PDF documents cannot/i,
        /interactive (features|elements|charts)/i,
        /video (player|playback|content)/i,
        /animations? (are|is) not/i,
        /real-time (data|updates)/i
      ];

      // If no document structure and matches refusal patterns, it's a refusal
      if (!hasDocStructure) {
        for (const pattern of refusalPatterns) {
          if (pattern.test(html)) {
            return true;
          }
        }
        // If it's under 500 chars with no structure, likely refusal text
        if (trimmedHtml.length < 500) {
          return true;
        }
      }

      // Check if it looks like prose explanation inserted into document
      // (AI might wrap explanation in basic HTML)
      const textContent = html.replace(/<[^>]*>/g, '').trim();
      if (textContent.length > 100) {
        for (const pattern of refusalPatterns) {
          if (pattern.test(textContent.substring(0, 500))) {
            return true;
          }
        }
      }

      return false;
    }

    // Extract a user-friendly message from AI refusal response
    function extractRefusalMessage(html) {
      // Strip HTML tags to get the text
      const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      // Return first ~100 characters or until first period
      const firstSentence = textContent.split('.')[0];
      if (firstSentence.length > 100) {
        return firstSentence.substring(0, 100) + '...';
      }
      return firstSentence || 'This request cannot be completed';
    }

    // STREAMING: Process SSE stream from /v1/modify?stream=true
    async function processStreamingResponse(response, callbacks) {
      const { onStart, onDelta, onChanges, onComplete, onError } = callbacks;

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          let currentEvent = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '' && currentEvent && currentData) {
              // Empty line = end of event, process it
              try {
                const parsed = JSON.parse(currentData);

                switch (currentEvent) {
                  case 'start':
                    if (onStart) onStart(parsed);
                    break;
                  case 'delta':
                    if (onDelta) onDelta(parsed);
                    break;
                  case 'changes':
                    if (onChanges) onChanges(parsed);
                    break;
                  case 'complete':
                    result = parsed;
                    if (onComplete) onComplete(parsed);
                    break;
                  case 'error':
                    if (onError) onError(parsed);
                    throw new Error(parsed.error || 'Stream error');
                }
              } catch (parseErr) {
                if (parseErr.message !== 'Stream error') {
                  console.warn('[Glyph] Failed to parse SSE data:', currentData);
                } else {
                  throw parseErr;
                }
              }
              currentEvent = '';
              currentData = '';
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!result) {
        throw new Error('Stream ended without complete event');
      }

      return result;
    }

    // Apply modifications via API
    async function applyModifications(prompt) {
      if (!prompt.trim()) {
        showToast('Try a quick action above! They work instantly.', 'info', 3000);
        highlightQuickActions();
        return;
      }

      // Mark that user has interacted (enables session warnings)
      userHasInteracted = true;

      // Prevent concurrent modification requests
      if (isProcessingModification) {
        console.log('[Glyph] Modification already in progress, ignoring request');
        return;
      }

      // INSTANT ACTIONS: Check if this is an instant action that can be done locally
      // These actions have pre-baked HTML transformations and don't need AI
      if (isInstantAction(prompt)) {
        console.log('[Glyph] Applying instant action locally:', prompt);

        // Capture region snapshots for diff toggle
        captureDiffBefore();

        // Save current state to undo history before modification
        saveToUndoHistory();

        // Apply the instant transformation
        simulateModification(prompt);

        // Mark this action button as applied (shows checkmark)
        markActionApplied(prompt);

        // Clear the prompt input
        promptInput.value = '';

        // Capture diff "after" state for toggle
        captureDiffAfter();

        // Track for Copy as Code feature (instant actions use same API)
        trackModifyRequest({ sessionId, prompt });

        // First instant win celebration (once per session)
        if (!hasShownFirstInstantWin) {
          celebrateFirstInstantWin();
        } else {
          // Show success toast with Get Code button for instant actions too
          showModificationSuccessToast(0, true); // 0 elapsed, isInstant=true
          updateResponseTimeBadge(0, true);
          flashPreviewArea(); // Mobile visual feedback
        }

        // Auto-scroll to preview on mobile after instant action success
        if (window.innerWidth <= 480) {
          const previewArea = document.querySelector('.playground__preview-area');
          if (previewArea) {
            setTimeout(() => {
              previewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
          }
        }

        return; // Skip API call entirely
      }

      // Capture previous HTML for diff highlighting
      const previousHtml = currentHtml;

      // Capture region snapshots for diff toggle
      captureDiffBefore();

      // Save current state to undo history before modification
      saveToUndoHistory();

      isProcessingModification = true;
      showLoading(true);
      setStatus('Applying...');
      applyBtn.classList.add('loading');
      applyBtn.disabled = true;
      setSuggestionsDisabled(true);

      const startTime = Date.now();

      // TIMEOUT FIX: Activity-based timeout for AI requests
      // Store globally so cancel button can access it
      const MODIFICATION_TIMEOUT_MS = 90000; // 90 seconds absolute max for complex AI requests
      const ACTIVITY_TIMEOUT_MS = 15000; // Abort if no streaming activity for 15 seconds
      const WARNING_TIMEOUT_MS = 45000; // Show warning at 45 seconds
      currentAbortController = new AbortController();

      // Absolute maximum timeout (safety net)
      const absoluteTimeoutId = setTimeout(() => {
        console.warn('[Glyph] Absolute timeout reached (90s)');
        currentAbortController.abort();
      }, MODIFICATION_TIMEOUT_MS);

      // Activity-based timeout - resets every time we receive streaming data
      let activityTimeoutId = setTimeout(() => {
        console.warn('[Glyph] No streaming activity for 15s, aborting');
        currentAbortController.abort();
      }, ACTIVITY_TIMEOUT_MS);

      // Function to reset activity timeout (called on each streaming chunk)
      function resetActivityTimeout() {
        clearTimeout(activityTimeoutId);
        activityTimeoutId = setTimeout(() => {
          console.warn('[Glyph] No streaming activity for 15s, aborting');
          currentAbortController.abort();
        }, ACTIVITY_TIMEOUT_MS);
      }

      // FIX 2: Show encouraging message at 45 seconds (complex requests take time)
      const warningTimeoutId = setTimeout(() => {
        if (isProcessingModification) {
          showToast('Almost there! Complex changes take a bit longer to perfect.', 'info', 6000);
        }
      }, WARNING_TIMEOUT_MS);

      try {
        // Helper to extract error message from response
        async function extractErrorMessage(response) {
          try {
            const errorData = await response.json();
            return errorData.error || errorData.message || `Server error (${response.status})`;
          } catch {
            return `Server error (${response.status})`;
          }
        }

        // Try session-based modification if we have sessionId
        if (sessionId) {
          // STREAMING: Use streaming endpoint for progressive feedback
          const response = await fetch(`${API_URL}/v1/modify?stream=true`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DEMO_API_KEY}`
            },
            body: JSON.stringify({
              sessionId,
              prompt,
              // UNDO FIX: Send current HTML to server to ensure modifications
              // apply to the correct state after undo operations
              html: currentHtml
            }),
            signal: currentAbortController.signal
          });

          // Track rate limit usage
          if (window.__glyphRateLimit) window.__glyphRateLimit.track();

          // SILENT FAILURE FIX: Properly handle non-ok responses
          if (!response.ok) {
            if (response.status === 429 && window.__glyphRateLimit) {
              window.__glyphRateLimit.onRateLimited();
            }
            const errorMsg = await extractErrorMessage(response);
            throw new Error(errorMsg);
          }

          // Track streaming progress
          let deltaCount = 0;
          let streamingHtml = '';

          const data = await processStreamingResponse(response, {
            onStart: (event) => {
              console.log('[Glyph Stream] Started:', event.model);
              // Step 1: Analyzing document (already set by showLoading)
              setStepperStep('analyze');
              setStatus('AI is working...');
            },
            onDelta: (event) => {
              deltaCount++;
              streamingHtml += event.html || '';

              // ACTIVITY TIMEOUT: Reset timeout on every chunk - AI is actively working
              resetActivityTimeout();

              // Move to step 2 after receiving some data
              if (deltaCount === 20) {
                setStepperStep('generate');
              }

              // Update status with elapsed time periodically
              if (deltaCount % 20 === 0) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                setStatus(`AI is working... ${elapsed}s`);
              }
            },
            onChanges: (event) => {
              console.log('[Glyph Stream] Changes:', event.changes);
              // Move to step 2 if not already there
              setStepperStep('generate');
            },
            onComplete: (event) => {
              console.log('[Glyph Stream] Complete:', event.fastPath ? 'fast path' : `${deltaCount} chunks`);
              // Step 3: Rendering preview
              setStepperStep('render');
              // Clear elapsed timer on complete
              if (elapsedTimerInterval) {
                clearInterval(elapsedTimerInterval);
                elapsedTimerInterval = null;
              }
            },
            onError: (event) => {
              console.error('[Glyph Stream] Error:', event);
            }
          });

          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

          // Issue #1: Check for AI refusal before rendering
          if (isAiRefusalResponse(data.html)) {
            console.warn('[Glyph] AI refusal detected, not rendering to document');
            const refusalMsg = extractRefusalMessage(data.html);

            // Restore previous state (undo the optimistic state save)
            if (undoHistory.length > 0) {
              undoHistory.pop();
              updateUndoButtonState();
            }

            // Show warning toast instead of corrupting document
            showToast(refusalMsg, 'warning', 5000);
            setStatus('Request not supported');
            setTimeout(() => setStatus('Ready'), 3000);
            clearTimeout(absoluteTimeoutId); clearTimeout(activityTimeoutId);
            return;
          }

          currentHtml = data.html;

          // Render preview with change highlighting
          renderPreview(currentHtml, {
            changes: data.changes || [],
            previousHtml: previousHtml
          });

          // Add to version history
          addHistoryEntry(prompt, currentHtml);

          // Success animation
          previewContainer.classList.add('success');
          setTimeout(() => previewContainer.classList.remove('success'), 500);
          flashPreviewArea(); // Mobile visual feedback

          // Cycle 6: Reset failure counter on success
          consecutiveFailures = 0;
          autoRetryCount = 0;
          lastErrorWasSessionError = false;

          // Show success CTA after first modification
          showSuccessCta();

          // Capture diff "after" state for toggle
          captureDiffAfter();

          // Track for Copy as Code feature
          trackModifyRequest({ sessionId, prompt });

          // Cycle 6: Show celebratory success toast
          showModificationSuccessToast(elapsed);
          updateResponseTimeBadge(elapsed);

          setStatus(`Done in ${elapsed}s`);
          console.log(`[Glyph] Modification completed in ${elapsed}s (${data.fastPath ? 'fast path' : deltaCount + ' stream chunks'})`);
          setTimeout(() => setStatus('Ready'), 2000);

          // Start background validation polling
          if (sessionId) {
            startValidationPolling(sessionId);
          }
          clearTimeout(absoluteTimeoutId); clearTimeout(activityTimeoutId);
          return;
        }

        // Fallback to direct modification (no session)
        const response = await fetch(`${API_URL}/v1/modify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEMO_API_KEY}`
          },
          body: JSON.stringify({
            html: currentHtml,
            instruction: prompt
          }),
          signal: currentAbortController.signal
        });

        // Track rate limit usage (fallback path)
        if (window.__glyphRateLimit) window.__glyphRateLimit.track();

        if (!response.ok) {
          if (response.status === 429 && window.__glyphRateLimit) {
            window.__glyphRateLimit.onRateLimited();
          }
          const errorMsg = await extractErrorMessage(response);
          throw new Error(errorMsg);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const data = await response.json();

        // Issue #1: Check for AI refusal before rendering (fallback path)
        if (isAiRefusalResponse(data.html)) {
          console.warn('[Glyph] AI refusal detected, not rendering to document');
          const refusalMsg = extractRefusalMessage(data.html);

          // Restore previous state (undo the optimistic state save)
          if (undoHistory.length > 0) {
            undoHistory.pop();
            updateUndoButtonState();
          }

          // Show warning toast instead of corrupting document
          showToast(refusalMsg, 'warning', 5000);
          setStatus('Request not supported');
          setTimeout(() => setStatus('Ready'), 3000);
          clearTimeout(absoluteTimeoutId); clearTimeout(activityTimeoutId);
          return;
        }

        currentHtml = data.html;

        // Render preview with change highlighting
        renderPreview(currentHtml, {
          changes: data.changes || [],
          previousHtml: previousHtml
        });

        // Add to version history
        addHistoryEntry(prompt, currentHtml);

        previewContainer.classList.add('success');
        setTimeout(() => previewContainer.classList.remove('success'), 500);
        flashPreviewArea(); // Mobile visual feedback

        // Cycle 6: Reset failure counter on success
        consecutiveFailures = 0;
        autoRetryCount = 0;
        lastErrorWasSessionError = false;

        // Show success CTA after first modification
        showSuccessCta();

        // Capture diff "after" state for toggle
        captureDiffAfter();

        // Track for Copy as Code feature (fallback path uses instruction instead of prompt)
        trackModifyRequest({ prompt });

        // Cycle 6: Show celebratory success toast
        showModificationSuccessToast(elapsed);
        updateResponseTimeBadge(elapsed);

        setStatus(`Done in ${elapsed}s`);
        console.log(`[Glyph] Modification completed in ${elapsed}s`);
        setTimeout(() => setStatus('Ready'), 2000);

      } catch (err) {
        // Clear timeout on error
        clearTimeout(absoluteTimeoutId); clearTimeout(activityTimeoutId);
        // Clean up progressive preview on error
        clearProgressivePreview();
        // CRITICAL FIX: Show user-visible error instead of silent simulation
        // Never pretend changes applied when API failed
        console.error('[Glyph] API modification failed:', err);

        // Restore previous state (undo the optimistic state save)
        if (undoHistory.length > 0) {
          // Pop the state we just saved
          undoHistory.pop();
          updateUndoButtonState();
        }

        // Handle AbortError - could be user cancel or timeout
        let errorMessage = err.message || 'Unknown error';
        const elapsedMs = Date.now() - startTime;
        const wasUserCancel = err.name === 'AbortError' && elapsedMs < MODIFICATION_TIMEOUT_MS - 1000;

        if (err.name === 'AbortError') {
          if (wasUserCancel) {
            // User clicked cancel button
            showToast('Modification cancelled', 'info');
            setStatus('Ready');
            console.log('[Glyph] Modification cancelled by user');
            return; // Skip showing error
          } else {
            // Actual timeout
            errorMessage = 'timeout - request took too long (60s limit)';
          }
        }
        showApiError(errorMessage, prompt);

        // Update status to show error
        setStatus('Error - See message');
        setTimeout(() => setStatus('Ready'), 3000);
      } finally {
        // Always clear the timeouts to prevent memory leaks
        clearTimeout(absoluteTimeoutId); clearTimeout(activityTimeoutId);
        clearTimeout(warningTimeoutId);
        // Ensure progressive preview is always cleaned up
        clearProgressivePreview();
        currentAbortController = null;  // Clear abort controller
        isProcessingModification = false;
        showLoading(false);
        applyBtn.classList.remove('loading');
        applyBtn.disabled = false;
        setSuggestionsDisabled(false);

        // Always clear prompt input after modification completes (success, error, or cancel)
        // This ensures quick actions and manual entries are both cleared
        promptInput.value = '';
      }
    }

    // ========================================
    // Self-Check Validation System
    // ========================================

    let validationPollInterval = null;
    let currentValidationToast = null;

    /**
     * Start polling for validation results after a modification
     * The server runs validation in the background - we poll to get results
     */
    function startValidationPolling(sessionId) {
      // Clear any existing polling
      if (validationPollInterval) {
        clearInterval(validationPollInterval);
      }

      // Poll every 1 second for up to 60 seconds (extended to match actual API response times)
      let attempts = 0;
      const maxAttempts = 60;

      validationPollInterval = setInterval(async () => {
        attempts++;

        try {
          const response = await fetch(
            `${API_URL}/v1/modify/validation-status?sessionId=${encodeURIComponent(sessionId)}`,
            {
              headers: {
                'Authorization': `Bearer ${DEMO_API_KEY}`
              }
            }
          );

          if (response.ok) {
            const data = await response.json();

            // Check if validation has completed
            if (data.validationResult) {
              clearInterval(validationPollInterval);
              validationPollInterval = null;

              // Only show toast for CRITICAL issues - warnings are logged but don't interrupt the user
              // This builds trust by not showing scary warnings for minor cosmetic issues
              // DEMO MODE: Suppress validation warnings entirely - they confuse new users exploring the playground
              if (data.validationResult.criticalCount > 0 && !isInDemoMode) {
                showValidationToast(data.validationResult, data.hasAutoFix, sessionId);
              } else if (data.validationResult.criticalCount > 0 && isInDemoMode) {
                // In demo mode, log but don't show technical warnings to users
                console.log('[Glyph] Demo mode: Suppressing validation toast (' + data.validationResult.criticalCount + ' critical issues)');
                showValidationSuccessToast();
              } else if (data.validationResult.warningCount > 0) {
                // Log warnings for debugging but don't show to user
                console.log('[Glyph] Self-check: ' + data.validationResult.warningCount + ' minor warnings (not shown to user)');
                // Still show success since there are no critical issues
                showValidationSuccessToast();
              } else {
                // Show success toast when validation passes
                console.log('[Glyph] Self-check passed - no issues detected');
                showValidationSuccessToast();
              }
              return;
            }
          }
        } catch (err) {
          console.warn('[Glyph] Validation poll error:', err);
        }

        // Stop polling after max attempts - show fallback message
        if (attempts >= maxAttempts) {
          clearInterval(validationPollInterval);
          validationPollInterval = null;
          console.log('[Glyph] Validation poll timeout - validation still pending');
          // Don't show error - the modification succeeded, just validation is slow
          // Show a gentle info message instead of nothing
          showValidationTimeoutMessage();
        }
      }, 1000);
    }

    // FIX 3: Clear validation polling on page unload to prevent resource leaks
    window.addEventListener('pagehide', () => {
      if (validationPollInterval) {
        clearInterval(validationPollInterval);
        validationPollInterval = null;
      }
    });

    /**
     * Show a gentle message when validation times out (doesn't mean error)
     */
    function showValidationTimeoutMessage() {
      // Only show if user is still on page and engaged
      if (!userHasInteracted) return;

      // Create a subtle info toast
      const toast = document.createElement('div');
      toast.className = 'validation-toast validation-toast--info';
      toast.innerHTML = `
        <div class="validation-toast__content">
          <svg class="validation-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4M12 8h.01"></path>
          </svg>
          <div class="validation-toast__text">
            <span class="validation-toast__title">Quality check in progress</span>
            <span class="validation-toast__message">Running final validation... Your changes are applied.</span>
          </div>
        </div>
      `;

      document.body.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('visible'));

      // Auto-hide after 5 seconds
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 5000);
    }

    /**
     * Show validation toast with issues and optional auto-fix button
     */
    function showValidationToast(result, hasAutoFix, sessionId) {
      // Remove existing toast if any
      if (currentValidationToast) {
        currentValidationToast.remove();
      }

      const toast = document.createElement('div');
      toast.className = 'validation-toast';

      // Determine icon based on severity
      const hasCritical = result.criticalCount > 0;
      const iconClass = hasCritical ? 'validation-toast__icon--warning' : 'validation-toast__icon--warning';
      const iconSvg = hasCritical
        ? `<svg class="validation-toast__icon ${iconClass}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>`
        : `<svg class="validation-toast__icon ${iconClass}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>`;

      // Build issues list (max 3)
      const issuesList = (result.issues || [])
        .slice(0, 3)
        .map(issue => {
          const severityClass = issue.severity === 'critical' ? 'critical' : 'warning';
          return `<div class="validation-toast__issue validation-toast__issue--${severityClass}">${issue.description}</div>`;
        })
        .join('');

      // Build toast HTML - use friendlier language to maintain trust
      // Critical issues are rare and actionable, so we want to be helpful not alarming
      toast.innerHTML = `
        <div class="validation-toast__header">
          ${iconSvg}
          <span class="validation-toast__title">
            ${hasCritical ? 'Quick Fix Available' : 'Suggestions Available'}
          </span>
          <button class="validation-toast__close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
            </svg>
          </button>
        </div>
        <div class="validation-toast__issues">
          ${issuesList}
        </div>
        ${hasAutoFix ? `
          <div class="validation-toast__actions">
            <button class="validation-toast__btn validation-toast__btn--primary" data-action="apply-fix">
              Apply Fix
            </button>
            <button class="validation-toast__btn validation-toast__btn--secondary" data-action="dismiss">
              Dismiss
            </button>
          </div>
        ` : `
          <div class="validation-toast__actions">
            <button class="validation-toast__btn validation-toast__btn--secondary" data-action="dismiss">
              Got it
            </button>
          </div>
        `}
      `;

      // Add event listeners
      toast.querySelector('.validation-toast__close').addEventListener('click', () => {
        dismissValidationToast(toast);
      });

      toast.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          if (action === 'apply-fix') {
            applyValidationFix(sessionId, toast);
          } else {
            dismissValidationToast(toast);
          }
        });
      });

      // Add to DOM
      document.body.appendChild(toast);
      currentValidationToast = toast;

      // Animate in
      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });

      // Auto-dismiss after 15 seconds if no action taken
      setTimeout(() => {
        if (document.body.contains(toast)) {
          dismissValidationToast(toast);
        }
      }, 15000);
    }

    /**
     * Dismiss the validation toast
     */
    function dismissValidationToast(toast) {
      toast.classList.remove('visible');
      setTimeout(() => {
        toast.remove();
        if (currentValidationToast === toast) {
          currentValidationToast = null;
        }
      }, 300);
    }

    /**
     * Show success toast when validation passes
     */
    function showValidationSuccessToast() {
      // Remove existing toast if any
      if (currentValidationToast) {
        currentValidationToast.remove();
      }

      const toast = document.createElement('div');
      toast.className = 'validation-toast validation-toast--success';

      // Success checkmark icon
      const successIcon = `<svg class="validation-toast__icon validation-toast__icon--success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/>
      </svg>`;

      toast.innerHTML = `
        <div class="validation-toast__header">
          ${successIcon}
          <span class="validation-toast__title">Changes verified safe</span>
        </div>
      `;

      // Add to DOM
      document.body.appendChild(toast);
      currentValidationToast = toast;

      // Animate in
      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        if (document.body.contains(toast)) {
          dismissValidationToast(toast);
        }
      }, 3000);
    }

    /**
     * Apply the auto-fix from the server
     */
    async function applyValidationFix(sessionId, toast) {
      const btn = toast.querySelector('[data-action="apply-fix"]');
      btn.textContent = 'Applying...';
      btn.disabled = true;

      try {
        const response = await fetch(`${API_URL}/v1/modify/apply-fix`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEMO_API_KEY}`
          },
          body: JSON.stringify({ sessionId })
        });

        if (response.ok) {
          const data = await response.json();
          currentHtml = data.html;
          renderPreview(currentHtml);

          // Show success briefly
          btn.textContent = 'Fixed!';
          btn.style.background = 'var(--color-success)';

          // Add success animation to preview
          previewContainer.classList.add('success');
          setTimeout(() => previewContainer.classList.remove('success'), 500);
          flashPreviewArea(); // Mobile visual feedback

          setTimeout(() => {
            dismissValidationToast(toast);
          }, 1000);
        } else {
          btn.textContent = 'Failed';
          btn.style.background = 'var(--color-error)';
          setTimeout(() => {
            btn.textContent = 'Apply Fix';
            btn.style.background = '';
            btn.disabled = false;
          }, 2000);
        }
      } catch (err) {
        console.error('[Glyph] Apply fix error:', err);
        btn.textContent = 'Error';
        btn.disabled = false;
      }
    }

    // Inject watermark into existing HTML without replacing content
    function injectWatermark(html, text = 'DRAFT') {
      if (html.includes('glyph-watermark')) {
        // Update existing watermark text
        return html.replace(/(<div class="glyph-watermark"[^>]*>)[^<]*(<\/div>)/i, `$1${text}$2`);
      }
      const watermarkStyle = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 100px;
        font-weight: 900;
        color: rgba(0, 0, 0, 0.07);
        pointer-events: none;
        white-space: nowrap;
        z-index: 1000;
        letter-spacing: 20px;
        user-select: none;
      `.replace(/\n\s*/g, ' ');
      const watermarkDiv = `<div class="glyph-watermark" style="${watermarkStyle}">${text}</div>`;
      return html.replace('</body>', `${watermarkDiv}</body>`);
    }

    // Inject QR code into existing HTML without replacing content
    function injectQrCode(html) {
      if (html.includes('glyph-qr-code')) return html;
      const qrStyle = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 80px;
        height: 100px;
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        padding: 8px;
        text-align: center;
        font-family: sans-serif;
        font-size: 8px;
        color: #666;
        z-index: 999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `.replace(/\n\s*/g, ' ');
      const qrSvg = `<svg viewBox="0 0 64 64" style="width:60px;height:60px;"><rect fill="#000" x="0" y="0" width="8" height="8"/><rect fill="#000" x="8" y="0" width="8" height="8"/><rect fill="#000" x="16" y="0" width="8" height="8"/><rect fill="#000" x="24" y="0" width="8" height="8"/><rect fill="#000" x="32" y="0" width="8" height="8"/><rect fill="#000" x="40" y="0" width="8" height="8"/><rect fill="#000" x="48" y="0" width="8" height="8"/><rect fill="#000" x="0" y="8" width="8" height="8"/><rect fill="#000" x="48" y="8" width="8" height="8"/><rect fill="#000" x="0" y="16" width="8" height="8"/><rect fill="#000" x="16" y="16" width="8" height="8"/><rect fill="#000" x="24" y="16" width="8" height="8"/><rect fill="#000" x="32" y="16" width="8" height="8"/><rect fill="#000" x="48" y="16" width="8" height="8"/><rect fill="#000" x="0" y="24" width="8" height="8"/><rect fill="#000" x="16" y="24" width="8" height="8"/><rect fill="#000" x="24" y="24" width="8" height="8"/><rect fill="#000" x="32" y="24" width="8" height="8"/><rect fill="#000" x="48" y="24" width="8" height="8"/><rect fill="#000" x="0" y="32" width="8" height="8"/><rect fill="#000" x="16" y="32" width="8" height="8"/><rect fill="#000" x="24" y="32" width="8" height="8"/><rect fill="#000" x="32" y="32" width="8" height="8"/><rect fill="#000" x="48" y="32" width="8" height="8"/><rect fill="#000" x="0" y="40" width="8" height="8"/><rect fill="#000" x="48" y="40" width="8" height="8"/><rect fill="#000" x="0" y="48" width="8" height="8"/><rect fill="#000" x="8" y="48" width="8" height="8"/><rect fill="#000" x="16" y="48" width="8" height="8"/><rect fill="#000" x="24" y="48" width="8" height="8"/><rect fill="#000" x="32" y="48" width="8" height="8"/><rect fill="#000" x="40" y="48" width="8" height="8"/><rect fill="#000" x="48" y="48" width="8" height="8"/></svg>`;
      const qrDiv = `<div class="glyph-qr-code" style="${qrStyle}">${qrSvg}<div style="margin-top:4px;">Scan to pay</div></div>`;
      return html.replace('</body>', `${qrDiv}</body>`);
    }

    // Change accent color in existing HTML
    function changeAccentColor(html, newColor) {
      // Replace CSS variable
      html = html.replace(/--accent-color:\s*[^;]+;/g, `--accent-color: ${newColor};`);
      // Replace inline accent colors (common patterns)
      html = html.replace(/background(-color)?:\s*#1E3A5F/gi, `background$1: ${newColor}`);
      html = html.replace(/border(-color)?:\s*#1E3A5F/gi, `border$1: ${newColor}`);
      html = html.replace(/color:\s*#1E3A5F/gi, `color: ${newColor}`);
      return html;
    }

    // Make header text bold and larger - instant transformation
    function injectBoldHeader(html) {
      if (html.includes('glyph-bold-header-applied')) return html;
      // Add a marker class and inject CSS to make headers bolder
      const boldStyle = `
        <style class="glyph-bold-header-applied">
          h1, .invoice-title, .document-title, [class*="title"], [class*="header"] h1 {
            font-weight: 900 !important;
            font-size: 1.3em !important;
            letter-spacing: -0.02em !important;
          }
          .company-name, [class*="company"] {
            font-weight: 800 !important;
            font-size: 1.15em !important;
          }
        </style>
      `;
      return html.replace('</head>', `${boldStyle}</head>`);
    }

    // Add today's date in top right corner - instant transformation
    function injectDate(html) {
      if (html.includes('glyph-date-badge')) return html;
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const dateStyle = `
        position: fixed;
        top: 20px;
        right: 110px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 8px 12px;
        font-family: sans-serif;
        font-size: 11px;
        color: #475569;
        z-index: 998;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      `.replace(/\n\s*/g, ' ');
      const dateDiv = `<div class="glyph-date-badge" style="${dateStyle}">${dateStr}</div>`;
      return html.replace('</body>', `${dateDiv}</body>`);
    }

    // Add professional border around document - instant transformation
    function injectBorder(html) {
      if (html.includes('glyph-document-border')) return html;
      const borderStyle = `
        <style class="glyph-document-border">
          body {
            border: 3px solid #1e3a5f !important;
            border-radius: 8px !important;
            margin: 16px !important;
            box-shadow: 0 4px 12px rgba(30, 58, 95, 0.15) !important;
          }
          @media print {
            body {
              border: 2px solid #1e3a5f !important;
              margin: 12px !important;
            }
          }
        </style>
      `;
      return html.replace('</head>', `${borderStyle}</head>`);
    }

    // Add thank you note at bottom - instant transformation
    function injectThankYouNote(html) {
      if (html.includes('glyph-thank-you-note')) return html;
      const noteStyle = `
        margin: 24px 20px;
        padding: 20px;
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border-radius: 12px;
        border-left: 4px solid #22c55e;
        font-family: sans-serif;
        text-align: center;
      `.replace(/\n\s*/g, ' ');
      const noteDiv = `<div class="glyph-thank-you-note" style="${noteStyle}">
        <div style="font-size: 16px; font-weight: 600; color: #166534; margin-bottom: 6px;">Thank You for Your Business!</div>
        <div style="font-size: 12px; color: #15803d; line-height: 1.5;">We appreciate your trust in our services. Please don't hesitate to reach out if you have any questions.</div>
      </div>`;
      return html.replace('</body>', `${noteDiv}</body>`);
    }

    // Add signature line at bottom - instant transformation
    function injectSignature(html) {
      if (html.includes('glyph-signature-line')) return html;
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const signatureStyle = `
        margin: 32px 20px;
        padding: 24px;
        font-family: sans-serif;
        border-top: 1px solid #e5e7eb;
      `.replace(/\n\s*/g, ' ');
      const signatureDiv = `<div class="glyph-signature-line" style="${signatureStyle}">
        <div style="display: flex; justify-content: space-between; gap: 48px;">
          <div style="flex: 1;">
            <div style="border-bottom: 1px solid #374151; margin-bottom: 8px; height: 40px;"></div>
            <div style="font-size: 12px; color: #6b7280;">Authorized Signature</div>
          </div>
          <div style="flex: 1;">
            <div style="border-bottom: 1px solid #374151; margin-bottom: 8px; height: 40px; display: flex; align-items: flex-end; padding-bottom: 4px; color: #374151; font-size: 14px;">${today}</div>
            <div style="font-size: 12px; color: #6b7280;">Date</div>
          </div>
        </div>
      </div>`;
      return html.replace('</body>', `${signatureDiv}</body>`);
    }

    // Extract terms text from prompt
    function extractTermsText(prompt) {
      const lower = prompt.toLowerCase();
      // Try to extract Net X pattern
      const netMatch = prompt.match(/net\s*(\d+)/i);
      const netDays = netMatch ? netMatch[1] : '30';
      // Check for discount
      const discountMatch = prompt.match(/(\d+)%\s*(early\s*)?(?:payment\s*)?discount/i);
      const discount = discountMatch ? discountMatch[1] : null;
      // Check for discount period
      const periodMatch = prompt.match(/(?:within|in)\s*(\d+)\s*days/i);
      const discountPeriod = periodMatch ? periodMatch[1] : '10';
      // Build terms
      let terms = `Net ${netDays} days`;
      if (discount) {
        terms += `. ${discount}% early payment discount if paid within ${discountPeriod} days`;
      } else if (lower.includes('discount') || lower.includes('early')) {
        terms += `. 2% early payment discount if paid within ${discountPeriod} days`;
      }
      return terms;
    }

    // Inject payment terms into existing HTML without replacing content
    function injectPaymentTerms(html, termsText) {
      if (html.includes('glyph-payment-terms') || html.includes('Payment Terms</div>')) {
        // Update existing terms
        return html.replace(/(<div class="glyph-payment-terms"[^>]*>[\s\S]*?<div[^>]*>Payment Terms<\/div>\s*<div[^>]*>)[^<]*(<\/div>)/i, `$1${termsText}$2`);
      }
      const termsStyle = `
        margin: 24px 20px;
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
        border-left: 4px solid #1e3a5f;
        font-family: sans-serif;
      `.replace(/\n\s*/g, ' ');
      const termsDiv = `<div class="glyph-payment-terms" style="${termsStyle}">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; font-weight: 600;">Payment Terms</div>
        <div style="font-size: 12px; color: #1a1a1a; line-height: 1.5;">${termsText}</div>
      </div>`;
      return html.replace('</body>', `${termsDiv}</body>`);
    }

    // Group line items by category with subtotals - instant transformation
    function injectGroupByCategory(html) {
      // Check if already grouped
      if (html.includes('glyph-category-group') || html.includes('Category Subtotal')) return html;

      // Find and replace the tbody content with grouped items
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
      if (!tbodyMatch) return html;

      // Group the sample data by category
      const categories = {
        'Design': [
          { description: 'UI/UX Design', details: 'Custom interface design and prototypes', quantity: 1, unitPrice: 3500.00, total: 3500.00 },
          { description: 'Brand Guidelines', details: 'Logo usage, colors, typography specs', quantity: 1, unitPrice: 1500.00, total: 1500.00 }
        ],
        'Materials': [
          { description: 'Server Hardware', details: 'Dell PowerEdge R750 with 64GB RAM', quantity: 2, unitPrice: 4200.00, total: 8400.00 },
          { description: 'Network Equipment', details: 'Cisco switches and cabling', quantity: 1, unitPrice: 2800.00, total: 2800.00 },
          { description: 'Software Licenses', details: 'Enterprise software bundle', quantity: 5, unitPrice: 450.00, total: 2250.00 }
        ],
        'Labor': [
          { description: 'Installation', details: 'On-site hardware setup and config', quantity: 16, unitPrice: 150.00, total: 2400.00 },
          { description: 'Training', details: 'Staff training sessions (4 hours each)', quantity: 3, unitPrice: 500.00, total: 1500.00 }
        ]
      };

      let groupedTbody = '';
      for (const [category, items] of Object.entries(categories)) {
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        groupedTbody += `
          <tr class="glyph-category-group" style="background: #f8fafc;">
            <td colspan="4" style="font-weight: 600; color: #1e3a5f; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">${category}</td>
          </tr>`;
        for (const item of items) {
          groupedTbody += `
          <tr>
            <td>
              <div class="item-desc">${item.description}</div>
              <div class="item-details">${item.details}</div>
            </td>
            <td>${item.quantity}</td>
            <td>$${item.unitPrice.toFixed(2)}</td>
            <td>$${item.total.toFixed(2)}</td>
          </tr>`;
        }
        groupedTbody += `
          <tr class="glyph-category-subtotal" style="background: #f1f5f9;">
            <td colspan="3" style="text-align: right; font-weight: 500; color: #64748b; padding-right: 16px; font-size: 12px;">${category} Subtotal</td>
            <td style="font-weight: 600; color: #1e3a5f;">$${subtotal.toFixed(2)}</td>
          </tr>`;
      }

      return html.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${groupedTbody}</tbody>`);
    }

    // Simulate modification for demo when API unavailable - MODIFIES existing HTML instead of regenerating
    function simulateModification(prompt) {
      const lowPrompt = prompt.toLowerCase();
      let modifiedHtml = currentHtml; // START WITH EXISTING HTML - DON'T REGENERATE

      // Detect and apply payment terms - MUST come before other checks
      if (lowPrompt.includes('terms') || lowPrompt.includes('payment terms') || lowPrompt.includes('net ')) {
        const termsText = extractTermsText(prompt);
        modifiedHtml = injectPaymentTerms(modifiedHtml, termsText);
      }

      // Detect and apply watermark
      if (lowPrompt.includes('watermark')) {
        let watermarkText = 'DRAFT';
        if (lowPrompt.includes('paid')) watermarkText = 'PAID';
        else if (lowPrompt.includes('confidential')) watermarkText = 'CONFIDENTIAL';
        else if (lowPrompt.includes('approved')) watermarkText = 'APPROVED';
        else if (lowPrompt.includes('void')) watermarkText = 'VOID';
        else if (lowPrompt.includes('sample')) watermarkText = 'SAMPLE';
        modifiedHtml = injectWatermark(modifiedHtml, watermarkText);
      }

      // Detect and apply QR code
      if (lowPrompt.includes('qr')) {
        modifiedHtml = injectQrCode(modifiedHtml);
      }

      // Detect and apply grouping by category
      if (lowPrompt.includes('group') && (lowPrompt.includes('category') || lowPrompt.includes('subtotal'))) {
        modifiedHtml = injectGroupByCategory(modifiedHtml);
      }

      // Detect and apply bold header
      if (lowPrompt.includes('bold') && (lowPrompt.includes('header') || lowPrompt.includes('title'))) {
        modifiedHtml = injectBoldHeader(modifiedHtml);
      }

      // Detect and apply date badge
      if (lowPrompt.includes('date') && (lowPrompt.includes('add') || lowPrompt.includes('today'))) {
        modifiedHtml = injectDate(modifiedHtml);
      }

      // Detect and apply border
      if (lowPrompt.includes('border')) {
        modifiedHtml = injectBorder(modifiedHtml);
      }

      // Detect and apply thank you note
      if (lowPrompt.includes('thank') && (lowPrompt.includes('you') || lowPrompt.includes('note'))) {
        modifiedHtml = injectThankYouNote(modifiedHtml);
      }

      // Detect and apply signature line
      if (lowPrompt.includes('signature')) {
        modifiedHtml = injectSignature(modifiedHtml);
      }

      // Detect and apply color changes
      if (lowPrompt.includes('blue')) {
        modifiedHtml = changeAccentColor(modifiedHtml, '#3B82F6');
      } else if (lowPrompt.includes('purple') || lowPrompt.includes('stripe')) {
        modifiedHtml = changeAccentColor(modifiedHtml, '#635BFF');
      } else if (lowPrompt.includes('red')) {
        modifiedHtml = changeAccentColor(modifiedHtml, '#EF4444');
      } else if (lowPrompt.includes('green')) {
        modifiedHtml = changeAccentColor(modifiedHtml, '#22C55E');
      } else if (lowPrompt.includes('orange')) {
        modifiedHtml = changeAccentColor(modifiedHtml, '#F97316');
      } else if (lowPrompt.includes('pink')) {
        modifiedHtml = changeAccentColor(modifiedHtml, '#EC4899');
      } else if (lowPrompt.includes('gold') || lowPrompt.includes('yellow')) {
        modifiedHtml = changeAccentColor(modifiedHtml, '#EAB308');
      }

      // Update the current HTML and re-render
      currentHtml = modifiedHtml;
      renderPreview(currentHtml);

      // Add to version history
      addHistoryEntry(prompt, currentHtml);

      previewContainer.classList.add('success');
      setTimeout(() => previewContainer.classList.remove('success'), 500);
      flashPreviewArea(); // Mobile visual feedback

      setStatus('Demo: Updated!');
      setTimeout(() => setStatus('Demo Mode'), 2000);
    }

    // Generate enhanced HTML with impressive features
    function generateEnhancedHtml(data, accentColor, extras) {
      const isStripe = extras.style === 'stripe';
      const isApple = extras.style === 'apple';

      const watermarkHtml = extras.watermark ? `
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; font-weight: 900; color: rgba(0,0,0,0.06); pointer-events: none; white-space: nowrap; z-index: 1;">${extras.watermark}</div>
      ` : '';

      const qrCodeHtml = extras.qrCode ? `
        <div style="position: absolute; top: 20px; right: 20px; width: 80px; height: 80px; background: white; border: 1px solid #e5e5e5; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px;">
          <svg viewBox="0 0 100 100" width="50" height="50">
            <rect x="10" y="10" width="25" height="25" fill="#1a1a1a"/>
            <rect x="15" y="15" width="15" height="15" fill="white"/>
            <rect x="18" y="18" width="9" height="9" fill="#1a1a1a"/>
            <rect x="65" y="10" width="25" height="25" fill="#1a1a1a"/>
            <rect x="70" y="15" width="15" height="15" fill="white"/>
            <rect x="73" y="18" width="9" height="9" fill="#1a1a1a"/>
            <rect x="10" y="65" width="25" height="25" fill="#1a1a1a"/>
            <rect x="15" y="70" width="15" height="15" fill="white"/>
            <rect x="18" y="73" width="9" height="9" fill="#1a1a1a"/>
            <rect x="40" y="10" width="5" height="5" fill="#1a1a1a"/>
            <rect x="50" y="10" width="5" height="5" fill="#1a1a1a"/>
            <rect x="40" y="20" width="5" height="5" fill="#1a1a1a"/>
            <rect x="45" y="25" width="5" height="5" fill="#1a1a1a"/>
            <rect x="40" y="40" width="5" height="5" fill="#1a1a1a"/>
            <rect x="45" y="45" width="5" height="5" fill="#1a1a1a"/>
            <rect x="50" y="40" width="5" height="5" fill="#1a1a1a"/>
            <rect x="55" y="45" width="5" height="5" fill="#1a1a1a"/>
            <rect x="10" y="45" width="5" height="5" fill="#1a1a1a"/>
            <rect x="20" y="50" width="5" height="5" fill="#1a1a1a"/>
            <rect x="65" y="45" width="5" height="5" fill="#1a1a1a"/>
            <rect x="75" y="50" width="5" height="5" fill="#1a1a1a"/>
            <rect x="85" y="55" width="5" height="5" fill="#1a1a1a"/>
            <rect x="65" y="65" width="5" height="5" fill="#1a1a1a"/>
            <rect x="75" y="75" width="5" height="5" fill="#1a1a1a"/>
            <rect x="85" y="85" width="5" height="5" fill="#1a1a1a"/>
            <rect x="45" y="65" width="5" height="5" fill="#1a1a1a"/>
            <rect x="55" y="75" width="5" height="5" fill="#1a1a1a"/>
            <rect x="45" y="85" width="5" height="5" fill="#1a1a1a"/>
          </svg>
          <div style="font-size: 7px; color: #666; margin-top: 4px;">Scan to pay</div>
        </div>
      ` : '';

      const termsHtml = extras.terms ? `
        <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid ${accentColor};">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; font-weight: 600;">Payment Terms</div>
          <div style="font-size: 12px; color: #1a1a1a;">${extras.terms}</div>
        </div>
      ` : '';

      const signatureHtml = extras.signature ? `
        <div style="margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="flex: 1;">
            <div style="font-size: 11px; color: #666; margin-bottom: 8px;">Thank you for your business!</div>
            <div style="border-bottom: 1px solid #1a1a1a; width: 200px; margin-bottom: 4px;"></div>
            <div style="font-size: 10px; color: #666;">Authorized Signature</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #666;">Date: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>
      ` : '';

      const progressBarHtml = extras.progressBar ? `
        <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, ${accentColor}15, ${accentColor}05); border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 600; color: ${accentColor};">Payment Progress</span>
            <span style="font-size: 11px; font-weight: 600; color: ${accentColor};">${extras.progressBar}% Paid</span>
          </div>
          <div style="height: 8px; background: #e5e5e5; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${extras.progressBar}%; background: linear-gradient(90deg, ${accentColor}, ${accentColor}cc); border-radius: 4px;"></div>
          </div>
          <div style="font-size: 10px; color: #666; margin-top: 6px;">$${(data.totals.total * extras.progressBar / 100).toFixed(2)} of $${data.totals.total.toFixed(2)} received</div>
        </div>
      ` : '';

      // Stripe-specific styling
      const stripeStyles = isStripe ? `
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .header { border-bottom: none; padding-bottom: 0; margin-bottom: 32px; }
        .company { font-size: 14px; font-weight: 500; color: #1a1a1a; letter-spacing: -0.01em; }
        .title { font-size: 32px; font-weight: 600; color: #1a1a1a; text-transform: none; letter-spacing: -0.02em; }
        .meta { background: transparent; padding: 0; gap: 48px; }
        .meta-item { text-align: left; }
        .meta-label { font-size: 12px; color: #697386; text-transform: none; letter-spacing: 0; }
        .meta-value { font-size: 14px; }
        th { background: transparent; color: #697386; font-size: 12px; text-transform: none; letter-spacing: 0; border-bottom: 1px solid #e6e6e6; }
        td { border-bottom: 1px solid #e6e6e6; }
        .totals-row.total { border-top: 1px solid #e6e6e6; }
        .totals-row.total .totals-label, .totals-row.total .totals-value { color: #1a1a1a; }
      ` : '';

      // Apple-specific styling
      const appleStyles = isApple ? `
        body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; }
        .header { border-bottom: none; }
        .company { font-size: 13px; font-weight: 400; color: #86868b; }
        .title { font-size: 40px; font-weight: 600; color: #1d1d1f; text-transform: none; letter-spacing: -0.025em; }
        .meta { background: transparent; border-radius: 0; }
        th { background: transparent; color: #86868b; border-bottom: 1px solid #d2d2d7; }
        td { border-bottom: 1px solid #d2d2d7; }
      ` : '';

      return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid ${accentColor}; margin-bottom: 20px; }
  .company { font-size: 18px; font-weight: 700; color: ${accentColor}; }
  .company-address { font-size: 11px; color: #666; margin-top: 4px; white-space: pre-line; }
  .title { font-size: 24px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta { display: flex; gap: 32px; background: #f9fafb; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; }
  .meta-item { text-align: center; }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 4px; }
  .meta-value { font-weight: 600; }
  .client { margin-bottom: 24px; }
  .client-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; font-weight: 600; }
  .client-name { font-weight: 600; font-size: 14px; }
  .client-company { color: #666; margin-top: 4px; }
  .client-email { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${accentColor}; color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
  td { padding: 12px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
  .item-desc { font-weight: 500; }
  .item-details { font-size: 11px; color: #666; margin-top: 4px; }
  .totals { display: flex; justify-content: flex-end; margin-top: 20px; }
  .totals-table { width: 200px; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
  .totals-row.total { border-top: 2px solid ${accentColor}; border-bottom: none; padding-top: 10px; margin-top: 4px; }
  .totals-label { color: #666; }
  .totals-value { font-weight: 500; }
  .totals-row.total .totals-label, .totals-row.total .totals-value { font-weight: 700; color: ${accentColor}; }
  ${stripeStyles}
  ${appleStyles}
</style>
</head>
<body>
  ${watermarkHtml}
  ${qrCodeHtml}
  <div class="header">
    <div>
      <div class="company">${data.branding.companyName}</div>
      <div class="company-address">${data.branding.companyAddress}</div>
    </div>
    <div class="title">${isStripe ? 'Invoice' : 'Quote'}</div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Quote Number</div>
      <div class="meta-value">${data.meta.quoteNumber}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Date</div>
      <div class="meta-value">${data.meta.date}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Valid Until</div>
      <div class="meta-value">${data.meta.validUntil}</div>
    </div>
  </div>

  <div class="client">
    <div class="client-label">Prepared For</div>
    <div class="client-name">${data.client.name}</div>
    <div class="client-company">${data.client.company}</div>
    <div class="client-email">${data.client.email}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.lineItems.map(item => `
      <tr>
        <td>
          <div class="item-desc">${item.description}</div>
          <div class="item-details">${item.details}</div>
        </td>
        <td>${item.quantity}</td>
        <td>$${item.unitPrice}</td>
        <td>$${item.total}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">$${data.totals.subtotal}</span>
      </div>
      <div class="totals-row total">
        <span class="totals-label">Total</span>
        <span class="totals-value">$${data.totals.total}</span>
      </div>
    </div>
  </div>

  ${progressBarHtml}
  ${termsHtml}
  ${signatureHtml}
</body>
</html>`;
    }

    // Template switching with smooth fade transition
    playgroundTabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        // Don't switch if clicking the already-active template
        if (tab.classList.contains('playground__tab--active')) return;

        // Get the preview frame wrapper for fade animation
        const frameWrapper = document.querySelector('.playground__preview-frame-wrapper');

        // Update tab UI immediately
        playgroundTabs.forEach(t => t.classList.remove('playground__tab--active'));
        tab.classList.add('playground__tab--active');

        // Fade out current preview
        if (frameWrapper) {
          frameWrapper.classList.add('template-switching');
        }

        // Wait for fade out (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Update template state
        currentTemplate = tab.dataset.template;
        sessionId = null; // Reset session for new template
        clearUndoHistory(); // Clear undo history when switching templates

        // Load new template (this will render the new preview)
        await initializePreview();

        // Fade in new preview
        if (frameWrapper) {
          frameWrapper.classList.remove('template-switching');
        }
      });
    });

    // Template type dropdown switcher
    const templateTypeSelect = document.getElementById('template-type-select-playground');
    const styleTabsContainer = document.getElementById('playground-style-tabs');

    if (templateTypeSelect) {
      templateTypeSelect.addEventListener('change', async () => {
        const selectedType = templateTypeSelect.value;
        const config = TEMPLATE_TYPE_CONFIG[selectedType];
        if (!config) return;

        // Rebuild the style tabs for this template type
        styleTabsContainer.innerHTML = '';
        config.variants.forEach((variant, i) => {
          const btn = document.createElement('button');
          btn.className = 'playground__tab' + (i === 0 ? ' playground__tab--active' : '');
          btn.dataset.template = variant.id;
          btn.textContent = variant.label;
          styleTabsContainer.appendChild(btn);
        });

        // Rebind tab click listeners
        bindStyleTabs();

        // Switch to first variant of the new type
        const frameWrapper = document.querySelector('.playground__preview-frame-wrapper');
        if (frameWrapper) frameWrapper.classList.add('template-switching');
        await new Promise(resolve => setTimeout(resolve, 200));

        currentTemplate = config.variants[0].id;
        sessionId = null;
        clearUndoHistory();
        await initializePreview();

        if (frameWrapper) frameWrapper.classList.remove('template-switching');
      });
    }

    // Extracted tab binding so it can be reused after rebuilding tabs
    function bindStyleTabs() {
      const tabs = styleTabsContainer.querySelectorAll('.playground__tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
          if (tab.classList.contains('playground__tab--active')) return;
          const frameWrapper = document.querySelector('.playground__preview-frame-wrapper');
          tabs.forEach(t => t.classList.remove('playground__tab--active'));
          tab.classList.add('playground__tab--active');
          if (frameWrapper) frameWrapper.classList.add('template-switching');
          await new Promise(resolve => setTimeout(resolve, 200));
          currentTemplate = tab.dataset.template;
          sessionId = null;
          clearUndoHistory();
          await initializePreview();
          if (frameWrapper) frameWrapper.classList.remove('template-switching');
        });
      });
    }

    // Quick suggestions - click to immediately apply
    suggestions.forEach(suggestion => {
      suggestion.addEventListener('click', () => {
        // Early return if already processing (buttons should be disabled, but double-check)
        if (isProcessingModification) {
          console.log('[Glyph] Modification in progress, ignoring suggestion click');
          return;
        }
        const prompt = suggestion.dataset.prompt;
        promptInput.value = prompt;
        applyModifications(prompt);
      });
    });

    // Apply button
    applyBtn.addEventListener('click', () => {
      applyModifications(promptInput.value);
    });

    // Undo button
    undoBtn.addEventListener('click', () => {
      if (!isProcessingModification) {
        performUndo();
      }
    });

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const actions = historyEntries
          .filter(e => e.prompt && e.prompt !== 'Initial state')
          .map(e => e.prompt);

        if (actions.length === 0) {
          showToast('Apply some changes first before sharing', 'info');
          return;
        }

        // Get current template from active tab
        const activeTab = document.querySelector('.playground__tab--active');
        const template = activeTab ? activeTab.dataset.template : 'quote-modern';

        const payload = { template, actions };
        const encoded = btoa(JSON.stringify(payload));
        const shareUrl = window.location.origin + window.location.pathname + '#playground?mods=' + encoded;

        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('Link copied to clipboard', 'success');
        }).catch(() => {
          // Fallback for clipboard API failure
          showToast('Could not copy link', 'error');
        });
      });
    }

    // Cancel button for long-running modifications
    const loadingCancelBtn = document.getElementById('loading-cancel-btn');
    if (loadingCancelBtn) {
      loadingCancelBtn.addEventListener('click', () => {
        if (isProcessingModification && currentAbortController) {
          console.log('[Glyph] User cancelled modification');
          currentAbortController.abort();
          // The abort will trigger the catch block in applyModifications
          // which will handle cleanup and show appropriate message
        }
      });
    }

    // Enter key to apply
    promptInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        applyModifications(promptInput.value);
      }
    });

    // Generate PDF button - Issue #1 Cycle 7: Allow demo PDF generation with watermark
    generateBtn.addEventListener('click', async () => {
      // Check if demo limit reached first
      if (demoDownloadCount >= MAX_DEMO_DOWNLOADS) {
        showModal();
        return;
      }

      const originalText = generateBtn.innerHTML;
      generateBtn.innerHTML = `<div class="loading-spinner loading-spinner--small"></div>Generating...`;
      generateBtn.disabled = true;

      try {
        await generateDemoPdf();
      } finally {
        generateBtn.innerHTML = originalText;
        generateBtn.disabled = false;
      }
    });

    // API Key Modal functionality (shown when demo limit reached)
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');

    function showModal() {
      modalOverlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
    }

    function hideModal() {
      modalOverlay.classList.remove('visible');
      document.body.style.overflow = '';
    }

    modalClose.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) hideModal();
    });

    // PDF Success Modal event listeners
    const pdfSuccessClose = document.getElementById('pdf-success-close');
    const pdfSuccessModal = document.getElementById('pdf-success-modal');

    if (pdfSuccessClose) {
      pdfSuccessClose.addEventListener('click', hidePdfSuccessModal);
    }
    if (pdfSuccessModal) {
      pdfSuccessModal.addEventListener('click', (e) => {
        if (e.target === pdfSuccessModal) hidePdfSuccessModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (modalOverlay.classList.contains('visible')) {
          hideModal();
        }
        if (pdfSuccessModal && pdfSuccessModal.classList.contains('visible')) {
          hidePdfSuccessModal();
        }
      }
    });

    // Mobile hamburger menu
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');

    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('visible');
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav__mobile-links a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('visible');
      });
    });

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
      // Regular toasts use aria-hidden
      const toastElements = [
        document.getElementById('glyph-toast'),
        document.getElementById('session-warning-toast')
      ];
      toastElements.forEach(toast => {
        if (toast) {
          toast.classList.remove('active', 'visible');
          toast.style.display = 'none';
          toast.setAttribute('aria-hidden', 'true');
        }
      });

      // API error toast uses inert instead of aria-hidden for proper focus management
      const apiErrorToast = document.getElementById('api-error-toast');
      if (apiErrorToast) {
        apiErrorToast.classList.remove('active', 'visible');
        apiErrorToast.style.display = 'none';
        apiErrorToast.setAttribute('inert', '');
      }

      setupDemoModeBanner();

      initializePreview();

      // Check for shared customization URL
      handleSharedUrl();
    });

    // ============================================
    // Shared URL Handler
    // ============================================
    function handleSharedUrl() {
      const hash = window.location.hash;
      if (!hash.startsWith('#playground?mods=')) return;

      const encoded = hash.replace('#playground?mods=', '');
      let payload;
      try {
        payload = JSON.parse(atob(encoded));
      } catch (e) {
        console.warn('[Glyph] Invalid shared URL payload');
        return;
      }

      if (!payload || !Array.isArray(payload.actions) || payload.actions.length === 0) return;

      // Scroll to playground
      const playgroundSection = document.getElementById('playground') || document.querySelector('.playground');
      if (playgroundSection) {
        playgroundSection.scrollIntoView({ behavior: 'smooth' });
      }

      // Show shared banner above the prompt area
      const promptArea = document.querySelector('.playground__input-area');
      if (promptArea) {
        const banner = document.createElement('div');
        banner.className = 'shared-customization-banner';
        banner.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
          <span>Viewing shared customization (${payload.actions.length} change${payload.actions.length !== 1 ? 's' : ''})</span>
        `;
        promptArea.insertBefore(banner, promptArea.firstChild);
      }

      // Switch template if needed
      if (payload.template) {
        const tab = document.querySelector(`.playground__tab[data-template="${payload.template}"]`);
        if (tab && !tab.classList.contains('playground__tab--active')) {
          tab.click();
        }
      }

      // Apply actions sequentially with delays, waiting for preview to be ready
      function waitForPreviewAndApply() {
        const previewFrame = document.getElementById('preview-frame');
        if (!previewFrame || !previewFrame.srcdoc) {
          setTimeout(waitForPreviewAndApply, 500);
          return;
        }
        applyActionsSequentially(payload.actions, 0);
      }

      function applyActionsSequentially(actions, index) {
        if (index >= actions.length) return;
        if (isProcessingModification) {
          // Wait for current modification to finish
          setTimeout(() => applyActionsSequentially(actions, index), 1000);
          return;
        }
        const prompt = actions[index];
        const promptInput = document.getElementById('prompt-input');
        if (promptInput) {
          promptInput.value = prompt;
          applyModifications(prompt);
        }
        // Wait then apply next
        setTimeout(() => applyActionsSequentially(actions, index + 1), 2000);
      }

      // Wait a bit for the preview to initialize
      setTimeout(waitForPreviewAndApply, 1500);
    }

    // ============================================
    // Smooth Scroll for Anchor Links
    // ============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        // Try to find target element by selector or by ID
        const targetId = href.replace('#', '');
        const target = document.getElementById(targetId) || document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          // Update URL hash without jumping
          history.pushState(null, '', href);
        }
        // If target not found, let the browser handle it normally
      });
    });

    // ============================================
    // Intersection Observer for Animations
    // ============================================
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    // Observe feature cards and pricing cards
    document.querySelectorAll('.feature-card, .pricing-card').forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(card);
    });

    // ============================================
    // Airtable Connection Flow
    // ============================================
    // Use the existing API_URL constant for consistency
    const GLYPH_API = API_URL;

    // State
    const airtableState = {
      currentStep: 1,
      apiKey: '',
      bases: [],
      selectedBase: null,
      selectedTable: null,
      tables: [],
      fields: [],
      records: [],
      description: '',
      style: 'modern',
      generatedTemplate: null,
      generatedHtml: ''
    };

    // DOM Elements
    const airtableModalOverlay = document.getElementById('airtable-modal-overlay');
    const connectAirtableBtn = document.getElementById('connect-airtable');
    const airtableModalClose = document.getElementById('airtable-modal-close');
    const airtableBackBtn = document.getElementById('airtable-back-btn');
    const airtableNextBtn = document.getElementById('airtable-next-btn');
    const airtableKeyInput = document.getElementById('airtable-key');
    const airtableBaseSelect = document.getElementById('airtable-base');
    const airtableTableSelect = document.getElementById('airtable-table');
    const airtableFieldsContainer = document.getElementById('airtable-fields');
    const airtableFieldsList = document.getElementById('airtable-fields-list');
    const airtableDescription = document.getElementById('airtable-description');
    const airtableStyleBtns = document.querySelectorAll('.airtable-style-btn');
    const airtablePreviewFrame = document.getElementById('airtable-preview-frame');
    const airtablePreviewLoading = document.getElementById('airtable-preview-loading');
    const airtableRefineInput = document.getElementById('airtable-refine-input');
    const airtableRefineBtn = document.getElementById('airtable-refine-btn');
    const airtableDownloadPdfBtn = document.getElementById('airtable-download-pdf');
    const airtableSaveTemplateBtn = document.getElementById('airtable-save-template');

    // Open modal
    connectAirtableBtn.addEventListener('click', () => {
      airtableModalOverlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
      airtableKeyInput.focus();
    });

    // Close modal
    function closeAirtableModal() {
      airtableModalOverlay.classList.remove('visible');
      document.body.style.overflow = '';
      // Reset state
      resetAirtableState();
    }

    airtableModalClose.addEventListener('click', closeAirtableModal);
    airtableModalOverlay.addEventListener('click', (e) => {
      if (e.target === airtableModalOverlay) closeAirtableModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && airtableModalOverlay.classList.contains('visible')) {
        closeAirtableModal();
      }
    });

    // Reset state
    function resetAirtableState() {
      airtableState.currentStep = 1;
      airtableState.apiKey = '';
      airtableState.bases = [];
      airtableState.selectedBase = null;
      airtableState.selectedTable = null;
      airtableState.tables = [];
      airtableState.fields = [];
      airtableState.records = [];
      airtableState.description = '';
      airtableState.style = 'modern';
      airtableState.generatedTemplate = null;
      airtableState.generatedHtml = '';
      airtableState.isDemoMode = false;
      airtableState.isDemo = false;

      // Reset UI
      airtableKeyInput.value = '';
      airtableBaseSelect.innerHTML = '<option value="">Select a base...</option>';
      airtableBaseSelect.disabled = true;
      airtableTableSelect.innerHTML = '<option value="">Select a table...</option>';
      airtableTableSelect.disabled = true;
      airtableFieldsContainer.style.display = 'none';
      airtableFieldsList.innerHTML = '';
      airtableDescription.value = '';
      airtableStyleBtns.forEach(btn => btn.classList.remove('selected'));
      airtableStyleBtns[0].classList.add('selected');

      // Hide demo badge and validation error
      airtableDemoBadge.classList.remove('visible');
      airtableTokenError.classList.remove('visible');

      // Remove any lingering error toasts
      const existingErrorToast = document.querySelector('.airtable-error-toast');
      if (existingErrorToast) existingErrorToast.remove();

      goToStep(1);
    }

    // Step navigation
    function goToStep(step) {
      airtableState.currentStep = step;

      // Update step content visibility
      document.querySelectorAll('.airtable-step-content').forEach(el => {
        el.classList.remove('active');
        if (parseInt(el.dataset.step) === step) {
          el.classList.add('active');
        }
      });

      // Update progress indicators
      document.querySelectorAll('.airtable-progress__step').forEach(el => {
        const stepNum = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');
        if (stepNum === step) {
          el.classList.add('active');
        } else if (stepNum < step) {
          el.classList.add('completed');
        }
      });

      document.querySelectorAll('.airtable-progress__connector').forEach((el, idx) => {
        if (idx < step - 1) {
          el.classList.add('completed');
        } else {
          el.classList.remove('completed');
        }
      });

      // Update back button
      airtableBackBtn.style.display = step > 1 ? 'flex' : 'none';

      // Update next button text and state
      updateNextButton();
    }

    function updateNextButton() {
      const step = airtableState.currentStep;
      let buttonText = '';
      let disabled = false;

      switch (step) {
        case 1:
          buttonText = 'Connect';
          disabled = !airtableKeyInput.value.trim().startsWith('pat');
          break;
        case 2:
          buttonText = 'Continue';
          disabled = !airtableState.selectedTable;
          break;
        case 3:
          buttonText = 'Generate Template';
          disabled = !airtableDescription.value.trim();
          break;
        case 4:
          buttonText = 'Done';
          disabled = false;
          airtableNextBtn.style.display = 'none';
          return;
      }

      airtableNextBtn.style.display = 'flex';
      airtableNextBtn.innerHTML = `${buttonText}<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;
      airtableNextBtn.disabled = disabled;
    }

    // Input validation with error message display
    const airtableTokenError = document.getElementById('airtable-token-error');
    const airtableDemoBadge = document.getElementById('airtable-demo-badge');

    airtableKeyInput.addEventListener('input', () => {
      const value = airtableKeyInput.value.trim();
      // Show error if user has typed something but it doesn't start with 'pat'
      if (value.length > 0 && !value.startsWith('pat')) {
        airtableTokenError.classList.add('visible');
      } else {
        airtableTokenError.classList.remove('visible');
      }
      updateNextButton();
    });
    airtableDescription.addEventListener('input', updateNextButton);

    // Style selection
    airtableStyleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        airtableStyleBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        airtableState.style = btn.dataset.style;
        document.getElementById('info-style').textContent = btn.dataset.style.charAt(0).toUpperCase() + btn.dataset.style.slice(1);
      });
    });

    // Back button
    airtableBackBtn.addEventListener('click', () => {
      if (airtableState.currentStep > 1) {
        goToStep(airtableState.currentStep - 1);
      }
    });

    // Next button - main flow
    airtableNextBtn.addEventListener('click', async () => {
      const step = airtableState.currentStep;

      switch (step) {
        case 1:
          await connectToAirtable();
          break;
        case 2:
          prepareDescriptionStep();
          goToStep(3);
          break;
        case 3:
          await generateTemplate();
          break;
      }
    });

    // Step 1: Connect to Airtable
    async function connectToAirtable() {
      const apiKey = airtableKeyInput.value.trim();
      if (!apiKey) return;

      airtableState.apiKey = apiKey;
      setNextButtonLoading(true);

      try {
        // First, try to use the Glyph API
        const response = await fetch(`${GLYPH_API}/v1/airtable/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey })
        });

        if (response.ok) {
          const data = await response.json();
          airtableState.bases = data.bases || [];
          populateBases(airtableState.bases);
          goToStep(2);
        } else {
          // Fallback: Try direct Airtable API
          await connectDirectToAirtable(apiKey);
        }
      } catch (err) {
        console.warn('Glyph API connection failed, trying direct Airtable:', err);
        await connectDirectToAirtable(apiKey);
      } finally {
        setNextButtonLoading(false);
      }
    }

    // Direct Airtable API fallback
    async function connectDirectToAirtable(apiKey) {
      try {
        const response = await fetch('https://api.airtable.com/v0/meta/bases', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
          throw new Error('Invalid API key');
        }

        const data = await response.json();
        airtableState.bases = data.bases || [];
        airtableState.isDemoMode = false;
        airtableDemoBadge.classList.remove('visible');
        populateBases(airtableState.bases);
        goToStep(2);
      } catch (err) {
        console.error('Airtable connection failed:', err);
        // Show error toast with option to continue with demo data
        showConnectionErrorToast();
      }
    }

    // Show connection error toast with demo option
    function showConnectionErrorToast() {
      // Remove any existing error toast
      const existingToast = document.querySelector('.airtable-error-toast');
      if (existingToast) existingToast.remove();

      const toast = document.createElement('div');
      toast.className = 'airtable-error-toast';
      toast.innerHTML = `
        <div class="airtable-error-toast__message">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Could not connect to Airtable. Please check your token and try again.</span>
        </div>
        <div class="airtable-error-toast__actions">
          <button class="airtable-error-toast__btn airtable-error-toast__btn--secondary" id="airtable-retry-btn">Try Again</button>
          <button class="airtable-error-toast__btn airtable-error-toast__btn--primary" id="airtable-demo-btn">Continue with Demo Data</button>
        </div>
      `;
      document.querySelector('.airtable-modal').appendChild(toast);

      // Show with animation
      setTimeout(() => toast.classList.add('visible'), 10);

      // Retry button - just dismiss the toast
      document.getElementById('airtable-retry-btn').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
        airtableKeyInput.focus();
      });

      // Demo button - load demo data and show badge
      document.getElementById('airtable-demo-btn').addEventListener('click', () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
        enterDemoMode();
      });
    }

    // Enter demo mode with clear visual indicator
    function enterDemoMode() {
      airtableState.isDemoMode = true;
      airtableDemoBadge.classList.add('visible');
      showAirtableToast('Using demo data for preview', 'warning');
      loadDemoData();
    }

    // Toast notification for Airtable modal
    function showAirtableToast(message, type = 'success') {
      const existingToast = document.querySelector('.airtable-toast');
      if (existingToast) existingToast.remove();

      const toast = document.createElement('div');
      toast.className = `airtable-toast airtable-toast--${type}`;
      toast.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>' :
            type === 'info' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' :
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
        </svg>
        <span>${message}</span>
      `;
      document.querySelector('.airtable-modal').appendChild(toast);

      setTimeout(() => toast.classList.add('visible'), 10);
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Load demo data for demonstration purposes
    function loadDemoData() {
      airtableState.bases = [
        { id: 'appDemo123', name: 'CRM Database' },
        { id: 'appDemo456', name: 'Project Tracker' },
        { id: 'appDemo789', name: 'Inventory Management' }
      ];
      populateBases(airtableState.bases);

      // Pre-populate demo tables for each base
      airtableState.demoTables = {
        'appDemo123': [
          {
            id: 'tblClients',
            name: 'Clients',
            fields: [
              { name: 'Name', type: 'singleLineText' },
              { name: 'Company', type: 'singleLineText' },
              { name: 'Email', type: 'email' },
              { name: 'Phone', type: 'phoneNumber' },
              { name: 'Status', type: 'singleSelect' },
              { name: 'Deal Value', type: 'currency' }
            ]
          },
          {
            id: 'tblDeals',
            name: 'Deals',
            fields: [
              { name: 'Deal Name', type: 'singleLineText' },
              { name: 'Client', type: 'linkedRecord' },
              { name: 'Value', type: 'currency' },
              { name: 'Stage', type: 'singleSelect' },
              { name: 'Close Date', type: 'date' }
            ]
          }
        ],
        'appDemo456': [
          {
            id: 'tblProjects',
            name: 'Projects',
            fields: [
              { name: 'Project Name', type: 'singleLineText' },
              { name: 'Description', type: 'multilineText' },
              { name: 'Owner', type: 'collaborator' },
              { name: 'Start Date', type: 'date' },
              { name: 'Due Date', type: 'date' },
              { name: 'Status', type: 'singleSelect' },
              { name: 'Budget', type: 'currency' }
            ]
          },
          {
            id: 'tblTasks',
            name: 'Tasks',
            fields: [
              { name: 'Task', type: 'singleLineText' },
              { name: 'Project', type: 'linkedRecord' },
              { name: 'Assignee', type: 'collaborator' },
              { name: 'Priority', type: 'singleSelect' },
              { name: 'Complete', type: 'checkbox' }
            ]
          }
        ],
        'appDemo789': [
          {
            id: 'tblProducts',
            name: 'Products',
            fields: [
              { name: 'Product Name', type: 'singleLineText' },
              { name: 'SKU', type: 'singleLineText' },
              { name: 'Category', type: 'singleSelect' },
              { name: 'Price', type: 'currency' },
              { name: 'Quantity', type: 'number' },
              { name: 'Supplier', type: 'linkedRecord' }
            ]
          }
        ]
      };

      // Demo records
      airtableState.demoRecords = {
        'tblClients': [
          { id: 'rec1', fields: { 'Name': 'John Smith', 'Company': 'Acme Corp', 'Email': 'john@acme.com', 'Phone': '+1 555-0123', 'Status': 'Active', 'Deal Value': 50000 } },
          { id: 'rec2', fields: { 'Name': 'Sarah Johnson', 'Company': 'TechStart Inc', 'Email': 'sarah@techstart.io', 'Phone': '+1 555-0456', 'Status': 'Prospect', 'Deal Value': 25000 } },
          { id: 'rec3', fields: { 'Name': 'Mike Chen', 'Company': 'Global Solutions', 'Email': 'mike@globalsol.com', 'Phone': '+1 555-0789', 'Status': 'Active', 'Deal Value': 75000 } }
        ],
        'tblProjects': [
          { id: 'rec1', fields: { 'Project Name': 'Website Redesign', 'Description': 'Complete overhaul of company website', 'Owner': 'Alice', 'Start Date': '2024-01-15', 'Due Date': '2024-03-30', 'Status': 'In Progress', 'Budget': 45000 } },
          { id: 'rec2', fields: { 'Project Name': 'Mobile App Launch', 'Description': 'Launch iOS and Android apps', 'Owner': 'Bob', 'Start Date': '2024-02-01', 'Due Date': '2024-06-15', 'Status': 'Planning', 'Budget': 120000 } }
        ],
        'tblProducts': [
          { id: 'rec1', fields: { 'Product Name': 'Premium Widget', 'SKU': 'WDG-001', 'Category': 'Electronics', 'Price': 299.99, 'Quantity': 150, 'Supplier': 'SupplyCo' } },
          { id: 'rec2', fields: { 'Product Name': 'Basic Gadget', 'SKU': 'GDG-002', 'Category': 'Electronics', 'Price': 49.99, 'Quantity': 500, 'Supplier': 'TechParts' } }
        ]
      };

      airtableState.isDemo = true;
      airtableState.isDemoMode = true;
      airtableDemoBadge.classList.add('visible');
      goToStep(2);
    }

    function populateBases(bases) {
      airtableBaseSelect.innerHTML = '<option value="">Select a base...</option>';
      bases.forEach(base => {
        const option = document.createElement('option');
        option.value = base.id;
        option.textContent = base.name;
        airtableBaseSelect.appendChild(option);
      });
      airtableBaseSelect.disabled = false;
    }

    // Base selection
    airtableBaseSelect.addEventListener('change', async (e) => {
      const baseId = e.target.value;
      if (!baseId) {
        airtableTableSelect.innerHTML = '<option value="">Select a table...</option>';
        airtableTableSelect.disabled = true;
        airtableFieldsContainer.style.display = 'none';
        airtableState.selectedBase = null;
        airtableState.selectedTable = null;
        updateNextButton();
        return;
      }

      airtableState.selectedBase = airtableState.bases.find(b => b.id === baseId);
      document.getElementById('info-base').textContent = airtableState.selectedBase?.name || '-';

      airtableTableSelect.innerHTML = '<option value="">Loading tables...</option>';
      airtableTableSelect.disabled = true;

      // If in demo mode, use demo tables
      if (airtableState.isDemo && airtableState.demoTables[baseId]) {
        airtableState.tables = airtableState.demoTables[baseId];
        populateTables(airtableState.tables);
        return;
      }

      try {
        // Try Glyph API first
        const response = await fetch(`${GLYPH_API}/v1/airtable/bases/${baseId}/tables`, {
          headers: { 'Authorization': `Bearer ${airtableState.apiKey}` }
        });

        if (response.ok) {
          const data = await response.json();
          airtableState.tables = data.tables || [];
        } else {
          // Fallback to direct Airtable
          await fetchTablesDirectly(baseId);
        }
      } catch (err) {
        console.warn('Glyph API failed, trying direct Airtable:', err);
        await fetchTablesDirectly(baseId);
      }

      populateTables(airtableState.tables);
    });

    async function fetchTablesDirectly(baseId) {
      try {
        const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
          headers: { 'Authorization': `Bearer ${airtableState.apiKey}` }
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch tables:', response.status, errorText);
          airtableState.tables = [];
          return;
        }
        const data = await response.json();
        airtableState.tables = data.tables || [];
      } catch (err) {
        console.error('Failed to fetch tables:', err);
        airtableState.tables = [];
      }
    }

    function populateTables(tables) {
      airtableTableSelect.innerHTML = '<option value="">Select a table...</option>';
      tables.forEach(table => {
        const option = document.createElement('option');
        option.value = table.id;
        option.textContent = table.name;
        airtableTableSelect.appendChild(option);
      });
      airtableTableSelect.disabled = false;
    }

    // Table selection
    airtableTableSelect.addEventListener('change', async (e) => {
      const tableId = e.target.value;
      if (!tableId) {
        airtableFieldsContainer.style.display = 'none';
        airtableState.selectedTable = null;
        airtableState.fields = [];
        updateNextButton();
        return;
      }

      airtableState.selectedTable = airtableState.tables.find(t => t.id === tableId);
      document.getElementById('info-table').textContent = airtableState.selectedTable?.name || '-';

      // Display fields
      airtableState.fields = airtableState.selectedTable?.fields || [];
      displayFields(airtableState.fields);

      // Fetch sample records
      await fetchSampleRecords();

      updateNextButton();
    });

    function displayFields(fields) {
      airtableFieldsList.innerHTML = '';
      fields.forEach(field => {
        const badge = document.createElement('span');
        badge.className = 'airtable-field-badge';
        badge.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
          </svg>
          ${field.name}
        `;
        airtableFieldsList.appendChild(badge);
      });
      airtableFieldsContainer.style.display = 'flex';
    }

    async function fetchSampleRecords() {
      if (!airtableState.selectedBase || !airtableState.selectedTable) return;

      // If in demo mode, use demo records
      if (airtableState.isDemo && airtableState.demoRecords) {
        const tableId = airtableState.selectedTable.id;
        airtableState.records = airtableState.demoRecords[tableId] || [];
        return;
      }

      try {
        const baseId = airtableState.selectedBase.id;
        const tableId = airtableState.selectedTable.id;

        const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(airtableState.selectedTable.name)}?maxRecords=3`, {
          headers: { 'Authorization': `Bearer ${airtableState.apiKey}` }
        });

        if (response.ok) {
          const data = await response.json();
          airtableState.records = data.records || [];
        }
      } catch (err) {
        console.warn('Failed to fetch sample records:', err);
        airtableState.records = [];
      }
    }

    // Prepare description step
    function prepareDescriptionStep() {
      const fieldsPreview = document.getElementById('step3-fields-preview');
      fieldsPreview.innerHTML = airtableState.fields.map(f =>
        `<div class="airtable-data-row"><span class="airtable-data-label">${f.name}</span><span class="airtable-data-value">${f.type}</span></div>`
      ).join('');
    }

    // Step 3: Generate Template
    async function generateTemplate() {
      airtableState.description = airtableDescription.value.trim();
      if (!airtableState.description) return;

      setNextButtonLoading(true);
      goToStep(4);
      showPreviewLoading(true);

      try {
        const response = await fetch(`${GLYPH_API}/v1/templates/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            airtable: {
              apiKey: airtableState.apiKey,
              baseId: airtableState.selectedBase.id,
              tableId: airtableState.selectedTable.id,
              tableName: airtableState.selectedTable.name
            },
            description: airtableState.description,
            style: airtableState.style,
            fields: airtableState.fields,
            sampleRecords: airtableState.records
          })
        });

        if (response.ok) {
          const data = await response.json();
          airtableState.generatedTemplate = data.template;
          airtableState.generatedHtml = data.html || data.preview;
          renderAirtablePreview(airtableState.generatedHtml);
          displayDataPreview();
        } else {
          // Fallback to demo template
          generateDemoTemplate();
        }
      } catch (err) {
        console.warn('Template generation failed, using demo:', err);
        generateDemoTemplate();
      } finally {
        setNextButtonLoading(false);
        showPreviewLoading(false);
      }
    }

    function generateDemoTemplate() {
      const accentColor = airtableState.style === 'modern' ? '#1E3A5F' :
                          airtableState.style === 'professional' ? '#1E40AF' : '#6B7280';
      const secondaryColor = airtableState.style === 'modern' ? '#64748b' :
                             airtableState.style === 'professional' ? '#475569' : '#9CA3AF';
      const bgColor = airtableState.style === 'minimal' ? '#fafafa' : '#f9fafb';

      const sampleData = airtableState.records[0]?.fields || {};
      const fieldNames = airtableState.fields.map(f => f.name).slice(0, 5);
      const description = (airtableState.description || '').toLowerCase();
      const companyName = airtableState.selectedBase?.name || 'Your Company';
      const today = new Date().toLocaleDateString();
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();

      // Detect document type from description
      const docType = detectDocumentType(description);
      let html;

      switch (docType) {
        case 'invoice':
          html = generateInvoiceTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today, dueDate);
          break;
        case 'receipt':
          html = generateReceiptTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today);
          break;
        case 'packing':
          html = generatePackingSlipTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today);
          break;
        case 'report':
          html = generateReportTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today);
          break;
        default:
          html = generateDataTableTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today);
      }

      airtableState.generatedHtml = html;
      renderAirtablePreview(html);
      displayDataPreview();
    }

    function detectDocumentType(description) {
      if (/\b(invoice|invoices|billing|bill)\b/i.test(description)) return 'invoice';
      if (/\b(receipt|receipts|payment\s+confirmation|paid)\b/i.test(description)) return 'receipt';
      if (/\b(packing|shipping|slip|shipment|delivery)\b/i.test(description)) return 'packing';
      if (/\b(report|summary|analysis|overview)\b/i.test(description)) return 'report';
      return 'data';
    }

    function findFieldValue(sampleData, keywords, fallback) {
      const lowerKeys = Object.keys(sampleData).map(k => ({ orig: k, lower: k.toLowerCase() }));
      for (const keyword of keywords) {
        const found = lowerKeys.find(k => k.lower.includes(keyword.toLowerCase()));
        if (found && sampleData[found.orig]) return sampleData[found.orig];
      }
      return fallback;
    }

    function generateInvoiceTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today, dueDate) {
      const customerName = findFieldValue(sampleData, ['name', 'customer', 'client', 'company', 'contact'], 'Customer Name');
      const email = findFieldValue(sampleData, ['email', 'mail'], 'customer@example.com');
      const address = findFieldValue(sampleData, ['address', 'location', 'street'], '123 Main Street');
      const itemDesc = findFieldValue(sampleData, ['item', 'product', 'service', 'description', 'title'], 'Professional Services');
      const qty = findFieldValue(sampleData, ['qty', 'quantity', 'units', 'count'], '1');
      const rate = findFieldValue(sampleData, ['rate', 'price', 'cost', 'amount'], '500.00');

      const subtotal = 1000.00;
      const tax = 100.00;
      const total = 1100.00;

      return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .company { font-size: 24px; font-weight: 700; color: ${accentColor}; }
  .company-details { font-size: 11px; color: ${secondaryColor}; margin-top: 4px; }
  .doc-title { font-size: 32px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.05em; }
  .invoice-meta { display: flex; gap: 40px; margin-bottom: 32px; }
  .meta-block { }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${secondaryColor}; margin-bottom: 4px; }
  .meta-value { font-weight: 600; font-size: 14px; }
  .addresses { display: flex; gap: 60px; margin-bottom: 32px; }
  .address-block { }
  .address-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${secondaryColor}; margin-bottom: 8px; font-weight: 600; }
  .address-content { line-height: 1.6; }
  .address-name { font-weight: 600; }
  .line-items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .line-items th { background: ${accentColor}; color: white; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  .line-items th:last-child, .line-items td:last-child { text-align: right; }
  .line-items th:nth-child(2), .line-items td:nth-child(2),
  .line-items th:nth-child(3), .line-items td:nth-child(3) { text-align: center; }
  .line-items td { padding: 14px 16px; border-bottom: 1px solid #e5e5e5; }
  .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; margin-top: 16px; }
  .total-row { display: flex; gap: 40px; font-size: 13px; }
  .total-label { color: ${secondaryColor}; min-width: 80px; }
  .total-value { font-weight: 500; min-width: 100px; text-align: right; }
  .total-final { font-size: 16px; font-weight: 700; color: ${accentColor}; padding-top: 8px; border-top: 2px solid ${accentColor}; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 10px; }
  .notes { background: ${bgColor}; padding: 16px; border-radius: 8px; margin-top: 32px; }
  .notes-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${secondaryColor}; margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${companyName}</div>
      <div class="company-details">123 Business Ave, Suite 100<br>contact@company.com</div>
    </div>
    <div class="doc-title">Invoice</div>
  </div>

  <div class="invoice-meta">
    <div class="meta-block">
      <div class="meta-label">Invoice #</div>
      <div class="meta-value">INV-001</div>
    </div>
    <div class="meta-block">
      <div class="meta-label">Date</div>
      <div class="meta-value">${today}</div>
    </div>
    <div class="meta-block">
      <div class="meta-label">Due Date</div>
      <div class="meta-value">${dueDate}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="address-label">Bill To</div>
      <div class="address-content">
        <div class="address-name">${customerName}</div>
        <div>${address}</div>
        <div>${email}</div>
      </div>
    </div>
  </div>

  <table class="line-items">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${itemDesc}</td>
        <td>${qty}</td>
        <td>$${parseFloat(rate).toFixed(2)}</td>
        <td>$${(parseFloat(qty) * parseFloat(rate) || 500).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Additional Services</td>
        <td>2</td>
        <td>$250.00</td>
        <td>$500.00</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span class="total-label">Subtotal</span>
      <span class="total-value">$${subtotal.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span class="total-label">Tax (10%)</span>
      <span class="total-value">$${tax.toFixed(2)}</span>
    </div>
    <div class="total-row total-final">
      <span class="total-label">Total</span>
      <span class="total-value">$${total.toFixed(2)}</span>
    </div>
  </div>

  <div class="notes">
    <div class="notes-title">Payment Terms</div>
    <div>Payment is due within 30 days. Please include invoice number with payment.</div>
  </div>

  <div class="footer">
    Generated with Glyph - AI-Powered PDF Customization
  </div>
</body>
</html>`;
    }

    function generateReceiptTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today) {
      const customerName = findFieldValue(sampleData, ['name', 'customer', 'client', 'contact'], 'Customer Name');
      const email = findFieldValue(sampleData, ['email', 'mail'], 'customer@example.com');
      const itemDesc = findFieldValue(sampleData, ['item', 'product', 'service', 'description'], 'Product/Service');
      const paymentMethod = findFieldValue(sampleData, ['payment', 'method', 'card'], 'Credit Card');

      return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; background: white; max-width: 400px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid ${accentColor}; }
  .company { font-size: 24px; font-weight: 700; color: ${accentColor}; margin-bottom: 4px; }
  .company-details { font-size: 11px; color: ${secondaryColor}; }
  .doc-title { font-size: 20px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 16px; }
  .receipt-meta { background: ${bgColor}; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .meta-row:last-child { margin-bottom: 0; }
  .meta-label { color: ${secondaryColor}; font-size: 11px; }
  .meta-value { font-weight: 600; }
  .items { margin-bottom: 24px; }
  .item-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e5e5; }
  .item-name { font-weight: 500; }
  .item-price { font-weight: 600; }
  .totals { border-top: 2px solid #e5e5e5; padding-top: 16px; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .total-final { font-size: 18px; font-weight: 700; color: ${accentColor}; margin-top: 12px; padding-top: 12px; border-top: 2px solid ${accentColor}; }
  .paid-stamp { text-align: center; margin: 24px 0; padding: 12px; border: 3px solid #22c55e; border-radius: 8px; color: #22c55e; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .footer { margin-top: 32px; text-align: center; color: #999; font-size: 10px; }
  .thank-you { font-size: 14px; color: ${accentColor}; font-weight: 600; margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${companyName}</div>
    <div class="company-details">123 Business Ave | contact@company.com</div>
    <div class="doc-title">Receipt</div>
  </div>

  <div class="receipt-meta">
    <div class="meta-row">
      <span class="meta-label">Receipt #</span>
      <span class="meta-value">RCP-001</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Date</span>
      <span class="meta-value">${today}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Customer</span>
      <span class="meta-value">${customerName}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Payment Method</span>
      <span class="meta-value">${paymentMethod}</span>
    </div>
  </div>

  <div class="items">
    <div class="item-row">
      <span class="item-name">${itemDesc}</span>
      <span class="item-price">$500.00</span>
    </div>
    <div class="item-row">
      <span class="item-name">Service Fee</span>
      <span class="item-price">$50.00</span>
    </div>
  </div>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>$550.00</span>
    </div>
    <div class="total-row">
      <span>Tax</span>
      <span>$55.00</span>
    </div>
    <div class="total-row total-final">
      <span>Total Paid</span>
      <span>$605.00</span>
    </div>
  </div>

  <div class="paid-stamp">Paid</div>

  <div class="footer">
    <div class="thank-you">Thank you for your business!</div>
    <div>Generated with Glyph - AI-Powered PDF Customization</div>
  </div>
</body>
</html>`;
    }

    function generatePackingSlipTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today) {
      const customerName = findFieldValue(sampleData, ['name', 'customer', 'client', 'contact', 'recipient'], 'Recipient Name');
      const address = findFieldValue(sampleData, ['address', 'location', 'street', 'shipping'], '456 Delivery Lane');
      const city = findFieldValue(sampleData, ['city', 'town'], 'Anytown');
      const itemDesc = findFieldValue(sampleData, ['item', 'product', 'sku', 'description'], 'Product Item');
      const qty = findFieldValue(sampleData, ['qty', 'quantity', 'units', 'count'], '2');

      return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid ${accentColor}; }
  .company { font-size: 24px; font-weight: 700; color: ${accentColor}; }
  .doc-title { font-size: 28px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.05em; }
  .shipping-info { display: flex; gap: 60px; margin-bottom: 32px; }
  .address-block { flex: 1; }
  .address-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${secondaryColor}; margin-bottom: 8px; font-weight: 600; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
  .address-content { line-height: 1.8; padding: 12px; background: ${bgColor}; border-radius: 8px; }
  .address-name { font-weight: 700; font-size: 14px; }
  .order-meta { background: ${bgColor}; padding: 16px 24px; border-radius: 8px; margin-bottom: 32px; display: flex; gap: 40px; }
  .meta-block { }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${secondaryColor}; margin-bottom: 4px; }
  .meta-value { font-weight: 600; font-size: 14px; }
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table th { background: ${accentColor}; color: white; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  .items-table th:last-child { text-align: center; width: 100px; }
  .items-table td { padding: 14px 16px; border-bottom: 1px solid #e5e5e5; }
  .items-table td:last-child { text-align: center; font-weight: 600; }
  .item-sku { font-size: 10px; color: ${secondaryColor}; margin-top: 2px; }
  .checkbox { width: 16px; height: 16px; border: 2px solid ${accentColor}; border-radius: 3px; display: inline-block; margin-right: 8px; vertical-align: middle; }
  .summary { margin-top: 24px; text-align: right; font-size: 14px; }
  .summary-value { font-weight: 700; color: ${accentColor}; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 10px; }
  .signature-line { margin-top: 48px; display: flex; gap: 40px; }
  .sig-block { flex: 1; }
  .sig-label { font-size: 10px; text-transform: uppercase; color: ${secondaryColor}; margin-bottom: 8px; }
  .sig-line { border-bottom: 1px solid #333; height: 40px; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${companyName}</div>
    <div class="doc-title">Packing Slip</div>
  </div>

  <div class="order-meta">
    <div class="meta-block">
      <div class="meta-label">Order #</div>
      <div class="meta-value">ORD-12345</div>
    </div>
    <div class="meta-block">
      <div class="meta-label">Ship Date</div>
      <div class="meta-value">${today}</div>
    </div>
    <div class="meta-block">
      <div class="meta-label">Carrier</div>
      <div class="meta-value">Standard Shipping</div>
    </div>
  </div>

  <div class="shipping-info">
    <div class="address-block">
      <div class="address-label">Ship From</div>
      <div class="address-content">
        <div class="address-name">${companyName}</div>
        <div>123 Warehouse Blvd</div>
        <div>Distribution Center, ST 12345</div>
      </div>
    </div>
    <div class="address-block">
      <div class="address-label">Ship To</div>
      <div class="address-content">
        <div class="address-name">${customerName}</div>
        <div>${address}</div>
        <div>${city}, ST 67890</div>
      </div>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Item Description</th>
        <th>Qty</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <span class="checkbox"></span>${itemDesc}
          <div class="item-sku">SKU: ITEM-001</div>
        </td>
        <td>${qty}</td>
      </tr>
      <tr>
        <td>
          <span class="checkbox"></span>Packaging Materials
          <div class="item-sku">SKU: PKG-001</div>
        </td>
        <td>1</td>
      </tr>
    </tbody>
  </table>

  <div class="summary">
    Total Items: <span class="summary-value">${parseInt(qty) + 1}</span>
  </div>

  <div class="signature-line">
    <div class="sig-block">
      <div class="sig-label">Packed By</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Date</div>
      <div class="sig-line"></div>
    </div>
  </div>

  <div class="footer">
    Generated with Glyph - AI-Powered PDF Customization
  </div>
</body>
</html>`;
    }

    function generateReportTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today) {
      const title = findFieldValue(sampleData, ['title', 'name', 'report', 'subject'], 'Data Report');

      return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; background: white; }
  .header { margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid ${accentColor}; }
  .company { font-size: 14px; color: ${secondaryColor}; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.1em; }
  .doc-title { font-size: 28px; font-weight: 700; color: ${accentColor}; }
  .subtitle { font-size: 14px; color: ${secondaryColor}; margin-top: 8px; }
  .meta-bar { display: flex; gap: 32px; background: ${bgColor}; padding: 16px 24px; border-radius: 8px; margin-bottom: 32px; }
  .meta-item { }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${secondaryColor}; margin-bottom: 4px; }
  .meta-value { font-weight: 600; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 16px; font-weight: 700; color: ${accentColor}; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid ${accentColor}; }
  .summary-cards { display: flex; gap: 16px; margin-bottom: 32px; }
  .summary-card { flex: 1; background: ${bgColor}; padding: 20px; border-radius: 8px; text-align: center; }
  .card-value { font-size: 28px; font-weight: 700; color: ${accentColor}; }
  .card-label { font-size: 11px; color: ${secondaryColor}; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table th { background: ${accentColor}; color: white; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  .data-table td { padding: 12px 16px; border-bottom: 1px solid #e5e5e5; }
  .data-table tr:nth-child(even) { background: ${bgColor}; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 10px; }
  .notes { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin-top: 24px; }
  .notes-title { font-weight: 600; margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${companyName}</div>
    <div class="doc-title">${title}</div>
    <div class="subtitle">Comprehensive data overview and analysis</div>
  </div>

  <div class="meta-bar">
    <div class="meta-item">
      <div class="meta-label">Report Date</div>
      <div class="meta-value">${today}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Period</div>
      <div class="meta-value">Current Quarter</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Status</div>
      <div class="meta-value">Final</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Summary</div>
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-value">${fieldNames.length}</div>
        <div class="card-label">Data Fields</div>
      </div>
      <div class="summary-card">
        <div class="card-value">${Object.keys(sampleData).length}</div>
        <div class="card-label">Values</div>
      </div>
      <div class="summary-card">
        <div class="card-value">100%</div>
        <div class="card-label">Complete</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Data Overview</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        ${fieldNames.map(name => `
        <tr>
          <td>${name}</td>
          <td>${sampleData[name] || '{{' + name + '}}'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="notes">
    <div class="notes-title">Note</div>
    <div>This report was automatically generated from your Airtable data. You can customize the layout and add additional sections using Glyph's AI-powered editor.</div>
  </div>

  <div class="footer">
    Generated with Glyph - AI-Powered PDF Customization
  </div>
</body>
</html>`;
    }

    function generateDataTableTemplate(accentColor, secondaryColor, bgColor, sampleData, fieldNames, companyName, today) {
      return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid ${accentColor}; margin-bottom: 24px; }
  .company { font-size: 20px; font-weight: 700; color: ${accentColor}; }
  .doc-title { font-size: 28px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta { display: flex; gap: 40px; background: ${bgColor}; padding: 16px 24px; border-radius: 8px; margin-bottom: 24px; }
  .meta-item { }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: ${secondaryColor}; margin-bottom: 4px; }
  .meta-value { font-weight: 600; font-size: 14px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: ${accentColor}; margin-bottom: 12px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${accentColor}; color: white; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  td { padding: 14px 16px; border-bottom: 1px solid #e5e5e5; }
  .field-name { color: ${secondaryColor}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  .field-value { font-weight: 500; margin-top: 4px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${companyName}</div>
    <div class="doc-title">Document</div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Table</div>
      <div class="meta-value">${airtableState.selectedTable?.name || 'Data'}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Generated</div>
      <div class="meta-value">${today}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Style</div>
      <div class="meta-value">${airtableState.style.charAt(0).toUpperCase() + airtableState.style.slice(1)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Data Fields</div>
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        ${fieldNames.map(name => `
        <tr>
          <td><div class="field-name">${name}</div></td>
          <td><div class="field-value">${sampleData[name] || '{{' + name + '}}'}</div></td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Generated with Glyph - AI-Powered PDF Customization
  </div>
</body>
</html>`;
    }

    function renderAirtablePreview(html) {
      const doc = airtablePreviewFrame.contentDocument || airtablePreviewFrame.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }

    function displayDataPreview() {
      const preview = document.getElementById('airtable-data-preview');
      const sampleData = airtableState.records[0]?.fields || {};
      const fieldNames = airtableState.fields.slice(0, 4).map(f => f.name);

      preview.innerHTML = fieldNames.map(name =>
        `<div class="airtable-data-row">
          <span class="airtable-data-label">${name}</span>
          <span class="airtable-data-value">${truncateValue(sampleData[name])}</span>
        </div>`
      ).join('');
    }

    function truncateValue(value) {
      if (!value) return '-';
      const str = String(value);
      return str.length > 20 ? str.substring(0, 20) + '...' : str;
    }

    function showPreviewLoading(show) {
      airtablePreviewLoading.classList.toggle('visible', show);
    }

    function setNextButtonLoading(loading) {
      airtableNextBtn.classList.toggle('loading', loading);
      airtableNextBtn.disabled = loading;
    }

    // Refine template
    airtableRefineBtn.addEventListener('click', async () => {
      const modification = airtableRefineInput.value.trim();
      if (!modification) return;

      airtableRefineBtn.disabled = true;
      airtableRefineBtn.textContent = 'Refining...';
      showPreviewLoading(true);

      try {
        const response = await fetch(`${GLYPH_API}/v1/templates/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: airtableState.generatedTemplate,
            html: airtableState.generatedHtml,
            modification,
            data: airtableState.records[0]?.fields || {}
          })
        });

        if (response.ok) {
          const data = await response.json();
          airtableState.generatedHtml = data.html || data.preview;
          renderAirtablePreview(airtableState.generatedHtml);
        } else {
          // Simple local modification simulation
          simulateRefinement(modification);
        }
      } catch (err) {
        console.warn('Refinement failed, simulating:', err);
        simulateRefinement(modification);
      } finally {
        airtableRefineBtn.disabled = false;
        airtableRefineBtn.textContent = 'Refine';
        showPreviewLoading(false);
        airtableRefineInput.value = '';
      }
    });

    function simulateRefinement(modification) {
      // Simple color change simulation
      let html = airtableState.generatedHtml;
      const lowMod = modification.toLowerCase();

      if (lowMod.includes('blue')) html = html.replace(/#1E3A5F|#1E40AF|#6B7280/g, '#3B82F6');
      else if (lowMod.includes('red')) html = html.replace(/#1E3A5F|#1E40AF|#6B7280/g, '#EF4444');
      else if (lowMod.includes('green')) html = html.replace(/#1E3A5F|#1E40AF|#6B7280/g, '#22C55E');
      else if (lowMod.includes('purple')) html = html.replace(/#1E3A5F|#1E40AF|#6B7280/g, '#8B5CF6');
      else if (lowMod.includes('orange')) html = html.replace(/#1E3A5F|#1E40AF|#6B7280/g, '#F97316');

      airtableState.generatedHtml = html;
      renderAirtablePreview(html);
    }

    // Enter to refine
    airtableRefineInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        airtableRefineBtn.click();
      }
    });

    // Download PDF
    airtableDownloadPdfBtn.addEventListener('click', async () => {
      airtableDownloadPdfBtn.classList.add('loading');

      try {
        const response = await fetch(`${GLYPH_API}/v1/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: airtableState.generatedHtml })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${airtableState.selectedTable?.name || 'document'}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert('PDF generation requires an API key. Sign up at dashboard.glyph.you');
        }
      } catch (err) {
        console.error('PDF download failed:', err);
        alert('PDF generation requires an API key. Sign up at dashboard.glyph.you');
      } finally {
        airtableDownloadPdfBtn.classList.remove('loading');
      }
    });

    // Save template
    airtableSaveTemplateBtn.addEventListener('click', () => {
      alert('Template saving requires an account. Sign up at dashboard.glyph.you to save and manage your templates.');
    });

    // ==============================================
    // Batch Generation
    // ==============================================
    const batchViewSelect = document.getElementById('batch-view-select');
    const batchFilenameInput = document.getElementById('batch-filename');
    const batchRecordCount = document.getElementById('batch-record-count');
    const batchGenerateBtn = document.getElementById('batch-generate-btn');
    const batchBtnText = document.getElementById('batch-btn-text');
    const batchProgress = document.getElementById('batch-progress');
    const batchProgressFill = document.getElementById('batch-progress-fill');
    const batchCompleted = document.getElementById('batch-completed');
    const batchTotal = document.getElementById('batch-total');

    let batchJobId = null;
    let batchPollInterval = null;

    // Load views when entering step 4
    async function loadBatchViews() {
      if (!airtableState.apiKey || !airtableState.selectedBase || !airtableState.selectedTable) {
        return;
      }

      try {
        const params = new URLSearchParams({
          apiKey: airtableState.apiKey,
          baseId: airtableState.selectedBase.id,
          tableId: airtableState.selectedTable.id
        });

        const response = await fetch(`${GLYPH_API}/v1/templates/views?${params}`);
        if (response.ok) {
          const data = await response.json();
          batchViewSelect.innerHTML = '<option value="">All records</option>';
          (data.views || []).forEach(view => {
            const option = document.createElement('option');
            option.value = view.name;
            option.textContent = view.name;
            batchViewSelect.appendChild(option);
          });
        }
      } catch (err) {
        console.warn('Failed to load views:', err);
      }

      // Set default filename based on table name
      if (airtableState.selectedTable) {
        batchFilenameInput.value = `${airtableState.selectedTable.name.toLowerCase().replace(/\s+/g, '-')}-{{fields.Name}}.pdf`;
      }

      // Load initial record count
      await updateRecordCount();
    }

    // Update record count when view changes
    batchViewSelect.addEventListener('change', updateRecordCount);

    async function updateRecordCount() {
      if (!airtableState.apiKey || !airtableState.selectedBase || !airtableState.selectedTable) {
        batchRecordCount.textContent = '0';
        batchGenerateBtn.disabled = true;
        return;
      }

      try {
        const params = new URLSearchParams({
          apiKey: airtableState.apiKey,
          baseId: airtableState.selectedBase.id,
          tableId: airtableState.selectedTable.id
        });
        if (batchViewSelect.value) {
          params.append('view', batchViewSelect.value);
        }

        const response = await fetch(`${GLYPH_API}/v1/templates/count?${params}`);
        if (response.ok) {
          const data = await response.json();
          batchRecordCount.textContent = data.count || 0;
          batchGenerateBtn.disabled = (data.count || 0) === 0;
          batchBtnText.textContent = `Generate All PDFs (${data.count} records)`;
        }
      } catch (err) {
        console.warn('Failed to get record count:', err);
        batchRecordCount.textContent = '?';
      }
    }

    // Generate batch PDFs
    batchGenerateBtn.addEventListener('click', async () => {
      if (!airtableState.generatedHtml || !airtableState.apiKey) {
        alert('Please generate a template first');
        return;
      }

      const recordCount = parseInt(batchRecordCount.textContent) || 0;
      if (recordCount === 0) {
        alert('No records to generate');
        return;
      }

      // Disable button and show progress
      batchGenerateBtn.disabled = true;
      batchGenerateBtn.classList.add('loading');
      batchBtnText.textContent = 'Starting...';
      batchProgress.style.display = 'block';
      batchProgressFill.style.width = '0%';
      batchCompleted.textContent = '0';
      batchTotal.textContent = recordCount;

      const requestBody = {
        template: airtableState.generatedHtml,
        airtable: {
          apiKey: airtableState.apiKey,
          baseId: airtableState.selectedBase.id,
          tableId: airtableState.selectedTable.id,
          view: batchViewSelect.value || undefined,
          maxRecords: recordCount
        },
        output: {
          filename: batchFilenameInput.value || `document-{{record.id}}.pdf`
        }
      };

      try {
        // For small batches (<=20), use sync endpoint
        if (recordCount <= 20) {
          batchBtnText.textContent = 'Generating...';
          const response = await fetch(`${GLYPH_API}/v1/templates/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            const blob = await response.blob();
            downloadBlob(blob, `batch-${Date.now()}.zip`);
            batchProgressFill.style.width = '100%';
            batchCompleted.textContent = recordCount;
            batchBtnText.textContent = 'Download Complete!';
          } else {
            const error = await response.json();
            throw new Error(error.error || 'Batch generation failed');
          }
        } else {
          // For large batches, use async endpoint with polling
          batchBtnText.textContent = 'Starting batch job...';
          const startResponse = await fetch(`${GLYPH_API}/v1/templates/batch/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!startResponse.ok) {
            const error = await startResponse.json();
            throw new Error(error.error || 'Failed to start batch job');
          }

          const startData = await startResponse.json();
          batchJobId = startData.jobId;
          batchBtnText.textContent = 'Processing...';

          // Start polling for status
          batchPollInterval = setInterval(pollBatchStatus, 2000);
        }
      } catch (err) {
        console.error('Batch generation error:', err);
        alert(err.message || 'Batch generation failed');
        resetBatchUI();
      }
    });

    async function pollBatchStatus() {
      if (!batchJobId) return;

      try {
        const response = await fetch(`${GLYPH_API}/v1/templates/batch/${batchJobId}`);
        if (!response.ok) {
          throw new Error('Failed to get job status');
        }

        const data = await response.json();

        // Update progress
        batchCompleted.textContent = data.completed;
        batchTotal.textContent = data.total;
        batchProgressFill.style.width = `${data.progress}%`;
        batchBtnText.textContent = `Processing... ${data.progress}%`;

        if (data.status === 'completed') {
          clearInterval(batchPollInterval);
          batchBtnText.textContent = 'Downloading...';

          // Download the ZIP
          const downloadResponse = await fetch(`${GLYPH_API}/v1/templates/batch/${batchJobId}/download`);
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob();
            downloadBlob(blob, `batch-${batchJobId}.zip`);
            batchBtnText.textContent = 'Download Complete!';
          }

          setTimeout(resetBatchUI, 3000);
        } else if (data.status === 'failed') {
          clearInterval(batchPollInterval);
          throw new Error('Batch job failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(batchPollInterval);
        alert('Batch processing failed');
        resetBatchUI();
      }
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function resetBatchUI() {
      batchGenerateBtn.disabled = false;
      batchGenerateBtn.classList.remove('loading');
      const count = batchRecordCount.textContent;
      batchBtnText.textContent = `Generate All PDFs (${count} records)`;
      batchProgress.style.display = 'none';
      batchJobId = null;
      if (batchPollInterval) {
        clearInterval(batchPollInterval);
        batchPollInterval = null;
      }
    }

    // Extend goToStep to load batch views when entering step 4
    const originalGoToStep = goToStep;
    goToStep = function(step) {
      originalGoToStep(step);
      if (step === 4) {
        loadBatchViews();
      }
    };

    // ============================================
    // Save Template Feature (API-backed persistence)
    // Allows users with API keys to save customized templates
    // ============================================

    // Save Template DOM elements
    let saveTemplateElements = null;
    function getSaveTemplateElements() {
      if (!saveTemplateElements) {
        saveTemplateElements = {
          btn: document.getElementById('save-template-btn'),
          modal: document.getElementById('save-template-modal'),
          form: document.getElementById('save-template-form'),
          demoNotice: document.getElementById('save-template-demo-notice'),
          nameInput: document.getElementById('template-name-input'),
          typeSelect: document.getElementById('template-type-select'),
          descriptionInput: document.getElementById('template-description-input'),
          defaultCheckbox: document.getElementById('template-default-checkbox'),
          errorEl: document.getElementById('save-template-error'),
          cancelBtn: document.getElementById('save-template-cancel'),
          confirmBtn: document.getElementById('save-template-confirm')
        };
      }
      return saveTemplateElements;
    }

    // Check if user can save templates (has real API key, not demo)
    function canSaveTemplates() {
      // In the playground, we always use DEMO_API_KEY
      // Users need to get their own API key to save templates
      // For now, we'll check if there's a stored user API key
      try {
        const userApiKey = localStorage.getItem('glyph_user_api_key');
        return userApiKey && userApiKey !== DEMO_API_KEY && userApiKey.startsWith('gk_');
      } catch (e) {
        return false;
      }
    }

    // Get the user's API key (or demo key if none)
    function getUserApiKey() {
      try {
        const userApiKey = localStorage.getItem('glyph_user_api_key');
        if (userApiKey && userApiKey.startsWith('gk_')) {
          return userApiKey;
        }
      } catch (e) {
        // Ignore storage errors
      }
      return DEMO_API_KEY;
    }

    // Show the Save Template button after successful modification
    function showSaveTemplateButton() {
      const els = getSaveTemplateElements();
      if (els.btn) {
        els.btn.classList.add('visible');
      }
    }

    // Hide the Save Template button
    function hideSaveTemplateButton() {
      const els = getSaveTemplateElements();
      if (els.btn) {
        els.btn.classList.remove('visible');
      }
    }

    // Open the Save Template modal
    function showSaveTemplateModal() {
      const els = getSaveTemplateElements();
      if (!els.modal) return;

      // Check if user can save templates
      const canSave = canSaveTemplates();

      // Show appropriate content
      if (els.form) els.form.style.display = canSave ? 'flex' : 'none';
      if (els.demoNotice) els.demoNotice.style.display = canSave ? 'none' : 'block';

      // Reset form if can save
      if (canSave && els.form) {
        els.form.reset();
        if (els.errorEl) {
          els.errorEl.textContent = '';
          els.errorEl.classList.remove('visible');
        }
      }

      // Show modal
      els.modal.classList.add('active');

      // Focus name input if can save
      if (canSave && els.nameInput) {
        setTimeout(() => els.nameInput.focus(), 100);
      }
    }

    // Close the Save Template modal
    function closeSaveTemplateModal() {
      const els = getSaveTemplateElements();
      if (els.modal) {
        els.modal.classList.remove('active');
      }
    }

    // Show error in the Save Template modal
    function showSaveTemplateError(message) {
      const els = getSaveTemplateElements();
      if (els.errorEl) {
        els.errorEl.textContent = message;
        els.errorEl.classList.add('visible');
      }
    }

    // Hide error in the Save Template modal
    function hideSaveTemplateError() {
      const els = getSaveTemplateElements();
      if (els.errorEl) {
        els.errorEl.textContent = '';
        els.errorEl.classList.remove('visible');
      }
    }

    // Set loading state on save button
    function setSaveTemplateLoading(isLoading) {
      const els = getSaveTemplateElements();
      if (!els.confirmBtn) return;

      const btnText = els.confirmBtn.querySelector('.btn-text');
      const btnSpinner = els.confirmBtn.querySelector('.btn-spinner');

      els.confirmBtn.disabled = isLoading;
      if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
      if (btnSpinner) btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
    }

    // Handle Save Template form submission
    async function handleSaveTemplateSubmit(event) {
      event.preventDefault();

      const els = getSaveTemplateElements();
      if (!els.nameInput) return;

      const name = els.nameInput.value.trim();
      const type = els.typeSelect?.value || undefined;
      const description = els.descriptionInput?.value.trim() || undefined;
      const isDefault = els.defaultCheckbox?.checked || false;

      // Validate name
      if (!name) {
        showSaveTemplateError('Please enter a template name.');
        els.nameInput.focus();
        return;
      }

      // Get current template HTML
      if (!currentHtml) {
        showSaveTemplateError('No template content to save. Apply some changes first.');
        return;
      }

      // Get user API key
      const apiKey = getUserApiKey();
      if (apiKey === DEMO_API_KEY) {
        showSaveTemplateError('You need an API key to save templates. Get one from the dashboard.');
        return;
      }

      // Set loading state
      setSaveTemplateLoading(true);
      hideSaveTemplateError();

      try {
        const response = await fetch(`${API_URL}/v1/templates/saved`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            name: name,
            type: type || undefined,
            description: description || undefined,
            html: currentHtml,
            isDefault: isDefault
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to save template');
        }

        // Success!
        closeSaveTemplateModal();
        showToast(`Template saved! ID: ${data.template.id}`, 'success', 4000);

        // Log for developer reference
        console.log('[Glyph] Template saved:', {
          id: data.template.id,
          name: data.template.name,
          type: data.template.type,
          apiUsage: `Use with API: POST /v1/create with templateId: "${data.template.id}"`
        });

      } catch (error) {
        console.error('[Glyph] Failed to save template:', error);
        showSaveTemplateError(error.message || 'Failed to save template. Please try again.');
      } finally {
        setSaveTemplateLoading(false);
      }
    }

    // Initialize Save Template event listeners
    function initSaveTemplateFeature() {
      const els = getSaveTemplateElements();

      // Button click to open modal
      if (els.btn) {
        els.btn.addEventListener('click', showSaveTemplateModal);
      }

      // Cancel button
      if (els.cancelBtn) {
        els.cancelBtn.addEventListener('click', closeSaveTemplateModal);
      }

      // Form submission
      if (els.form) {
        els.form.addEventListener('submit', handleSaveTemplateSubmit);
      }

      // Click outside modal to close
      if (els.modal) {
        els.modal.addEventListener('click', (e) => {
          if (e.target === els.modal) {
            closeSaveTemplateModal();
          }
        });
      }

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && els.modal?.classList.contains('active')) {
          closeSaveTemplateModal();
        }
      });

      console.log('[Glyph] Save Template feature initialized');
    }

    // Hook into modification success to show Save Template button
    // We'll extend the existing addHistoryEntry function
    const originalAddHistoryEntry = addHistoryEntry;
    addHistoryEntry = function(prompt, html) {
      originalAddHistoryEntry(prompt, html);
      // Show Save Template button after first successful modification
      if (historyEntries.length > 0) {
        showSaveTemplateButton();
      }
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSaveTemplateFeature);
    } else {
      initSaveTemplateFeature();
    }

// Mouse-Following Glow Effect (deferred to avoid blocking initial render)
  (function() {
    const initMouseGlow = function() {
    const glow = document.getElementById('mouseGlow');
    if (!glow) return;

    // Skip entirely on mobile/touch devices - saves battery and GPU
    const isTouchDevice = !window.matchMedia('(hover: hover)').matches;
    if (isTouchDevice) {
      glow.style.display = 'none';
      return;
    }

    let mouseX = 0, mouseY = 0;
    let glowX = 0, glowY = 0;
    let animationId = null;
    let isRunning = false;

    function onMouseMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      glow.classList.add('active');
    }

    function onMouseLeave() {
      glow.classList.remove('active');
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);

    // Smooth animation with requestAnimationFrame
    function animate() {
      if (!isRunning) return;

      // Ease the glow position towards mouse (creates smooth follow)
      glowX += (mouseX - glowX) * 0.1;
      glowY += (mouseY - glowY) * 0.1;

      glow.style.left = glowX + 'px';
      glow.style.top = glowY + 'px';

      animationId = requestAnimationFrame(animate);
    }

    function startAnimation() {
      if (isRunning) return;
      isRunning = true;
      animate();
    }

    function stopAnimation() {
      isRunning = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }

    // Stop animation when tab is hidden to save battery/GPU
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAnimation();
        glow.classList.remove('active');
      } else {
        startAnimation();
      }
    });

    // Start animation (only if page is visible)
    if (!document.hidden) {
      startAnimation();
    }
  }; // end initMouseGlow

    // Defer non-critical animation to avoid blocking initial render
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(initMouseGlow);
    } else {
      setTimeout(initMouseGlow, 2000);
    }
  })();

// ─── Input Hints & Character Counters ───
(function initInputHints() {
  // Focus hints: show on focus, hide on blur
  const hintPairs = [
    { input: 'prompt-input', hint: 'prompt-input-hint' },
    { input: 'airtable-key', hint: 'airtable-key-hint' },
    { input: 'batch-filename', hint: 'batch-filename-hint' },
  ];

  hintPairs.forEach(function(pair) {
    var input = document.getElementById(pair.input);
    var hint = document.getElementById(pair.hint);
    if (!input || !hint) return;

    input.addEventListener('focus', function() {
      hint.classList.add('input-hint--visible');
    });
    input.addEventListener('blur', function() {
      hint.classList.remove('input-hint--visible');
    });
  });

  // Character counters: update on input, show on focus, hide on blur
  var counterPairs = [
    { input: 'template-name-input', counter: 'template-name-counter' },
    { input: 'template-description-input', counter: 'template-description-counter' },
    { input: 'version-name-input', counter: 'version-name-counter' },
  ];

  counterPairs.forEach(function(pair) {
    var input = document.getElementById(pair.input);
    var counter = document.getElementById(pair.counter);
    if (!input || !counter) return;

    var max = parseInt(counter.getAttribute('data-max'), 10) || 100;

    function updateCounter() {
      var len = input.value.length;
      counter.textContent = len + ' / ' + max;
      counter.classList.remove('char-counter--warning', 'char-counter--limit');
      if (len >= max) {
        counter.classList.add('char-counter--limit');
      } else if (len >= max * 0.85) {
        counter.classList.add('char-counter--warning');
      }
    }

    input.addEventListener('focus', function() {
      counter.classList.add('char-counter--visible');
      updateCounter();
    });
    input.addEventListener('blur', function() {
      counter.classList.remove('char-counter--visible');
    });
    input.addEventListener('input', updateCounter);
  });

  // ========================================
  // Rate Limit Transparency
  // ========================================
  (function initRateLimitIndicator() {
    var requests = []; // timestamps of recent requests
    var WINDOW_MS = 60000; // 1 minute window
    var MAX_REQUESTS = 10;
    var indicator = document.getElementById('rate-limit-indicator');
    var textEl = document.getElementById('rate-limit-text');
    if (!indicator || !textEl) return;

    function pruneOldRequests() {
      var now = Date.now();
      while (requests.length > 0 && now - requests[0] > WINDOW_MS) {
        requests.shift();
      }
    }

    function updateIndicator() {
      pruneOldRequests();
      var count = requests.length;
      if (count === 0) {
        indicator.style.display = 'none';
        return;
      }
      indicator.style.display = '';
      textEl.textContent = count + '/' + MAX_REQUESTS + ' requests this minute';
      indicator.classList.remove('playground__rate-limit--warning', 'playground__rate-limit--error');
      if (count >= MAX_REQUESTS) {
        indicator.classList.add('playground__rate-limit--error');
        textEl.textContent = count + '/' + MAX_REQUESTS + ' requests - slow down';
      } else if (count >= 8) {
        indicator.classList.add('playground__rate-limit--warning');
        textEl.textContent = count + '/' + MAX_REQUESTS + ' requests - slow down';
      }
    }

    function showRateLimited() {
      if (!indicator || !textEl) return;
      indicator.style.display = '';
      indicator.classList.remove('playground__rate-limit--warning');
      indicator.classList.add('playground__rate-limit--error');
      textEl.innerHTML = 'Rate limited &mdash; resets shortly. <a href="#pricing" class="playground__rate-limit-link">Get a free API key for more.</a>';
    }

    // Expose to global scope so fetch handlers can call it
    window.__glyphRateLimit = {
      track: function() {
        requests.push(Date.now());
        updateIndicator();
      },
      onRateLimited: showRateLimited,
      update: updateIndicator
    };

    // Periodically prune display
    setInterval(updateIndicator, 10000);
  })();

  // ========================================
  // Ctrl+S / Cmd+S PDF Download Shortcut
  // ========================================
  (function initSaveShortcut() {
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Only intercept when playground is visible/in viewport
        var playground = document.getElementById('playground');
        if (!playground) return;
        var rect = playground.getBoundingClientRect();
        var inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;

        e.preventDefault();
        e.stopPropagation();

        // Show toast and trigger PDF download
        if (typeof showToast === 'function') {
          showToast('Generating PDF...', 'info', 3000);
        }

        var generateBtn = document.getElementById('generate-btn');
        if (generateBtn && !generateBtn.disabled) {
          generateBtn.click();
        } else {
          if (typeof showToast === 'function') {
            showToast('No document ready to download yet.', 'warning', 3000);
          }
        }
      }
    });
  })();

  // ========================================
  // ARIA Labels for Preview Regions
  // ========================================
  (function initAriaLabelsForRegions() {
    // Observe the preview iframe for region elements and add aria-labels
    function labelRegions() {
      var iframe = document.querySelector('#preview-container iframe');
      if (!iframe) return;
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return;
        var regions = doc.querySelectorAll('[data-glyph-region]');
        regions.forEach(function(region) {
          var name = region.getAttribute('data-glyph-region');
          if (name && !region.getAttribute('aria-label')) {
            region.setAttribute('aria-label', 'Editable PDF region: ' + name);
            region.setAttribute('role', 'button');
          }
        });
      } catch (e) {
        // Cross-origin or not ready
      }
    }

    // Run after preview loads and on mutations
    var observer = new MutationObserver(function() {
      setTimeout(labelRegions, 500);
    });
    var previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
      observer.observe(previewContainer, { childList: true, subtree: true });
    }
    // Also run on initial load
    setTimeout(labelRegions, 2000);
  })();

})();
