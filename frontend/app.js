/**
 * app.js — Rating System Login
 * Handles: password visibility toggle, field validation,
 *          form submission, star-based loading indicator.
 *
 * Star animation contract:
 *   Loading  → JS adds  .star-loading-{1,2,3}  (CSS keyframe loop)
 *   Success  → JS swaps to .star-success        (CSS transition settle)
 *   Error    → JS swaps to .star-error          (CSS transition settle)
 *   Reset    → JS removes all star state classes
 */

(function () {
  'use strict';

  /* ── Element references ───────────────────────────────────── */
  const form           = document.getElementById('login-form');
  const intraLogin     = document.getElementById('intra-login');
  const intraPassword  = document.getElementById('intra-password');
  const toggleVisBtn   = document.getElementById('toggle-visibility');
  const visibilityIcon = document.getElementById('visibility-icon');
  const signinBtn      = document.getElementById('signin-btn');
  const errorBox       = document.getElementById('error-message-box');
  const successAlert   = document.getElementById('success-alert');

  // Field wrappers for inline validation
  const loginWrap    = intraLogin    && intraLogin.closest('.field-wrap');
  const passwordWrap = intraPassword && intraPassword.closest('.field-wrap');

  // The three star <path> elements used as the loading indicator
  const starPaths = [
    document.getElementById('star-path-1'),
    document.getElementById('star-path-2'),
    document.getElementById('star-path-3'),
  ];

  /* ── Star class names ─────────────────────────────────────── */
  const LOAD_CLASSES = ['star-loading-1', 'star-loading-2', 'star-loading-3'];
  const STAR_SUCCESS = 'star-success';
  const STAR_ERROR   = 'star-error';
  const ALL_STAR_CLASSES = [...LOAD_CLASSES, STAR_SUCCESS, STAR_ERROR];

  /* ── Star helpers ─────────────────────────────────────────── */

  /**
   * Remove every star-state class → back to base .star-path (outlined white).
   */
  function starsReset() {
    starPaths.forEach((el) => {
      if (!el) return;
      el.classList.remove(...ALL_STAR_CLASSES);
    });
  }

  /**
   * Start the sequential loading wave.
   * Each star gets its own loading class; CSS animation-delay (0 / 150 / 300 ms)
   * creates the left-to-right stagger. animation-fill-mode: both keeps each
   * star at opacity 0 during its delay so there is no flash.
   *
   * Force-reflow (void el.offsetWidth) between removing old classes and
   * adding new ones restarts the CSS animation from keyframe 0% cleanly.
   */
  function starsStartLoading() {
    starPaths.forEach((el, i) => {
      if (!el) return;
      el.classList.remove(...ALL_STAR_CLASSES);
      void el.offsetWidth;              // flush: restart animation from 0%
      el.classList.add(LOAD_CLASSES[i]);
    });
  }

  /**
   * Stop loading → settle to filled teal.
   *
   * We remove the looping animation in one rAF tick, then add .star-success
   * in the next tick. This two-frame gap lets the browser record the
   * animation's mid-cycle opacity/transform as the CSS transition start-point,
   * giving a smooth settle rather than a snap.
   */
  function starsShowSuccess() {
    starPaths.forEach((el, i) => {
      if (!el) return;
      el.classList.remove(LOAD_CLASSES[i]);       // tick A: animation stops
    });
    requestAnimationFrame(() => {
      starPaths.forEach((el) => {
        if (!el) return;
        el.classList.add(STAR_SUCCESS);            // tick B: transition begins
      });
    });
  }

  /**
   * Stop loading → fade back to outlined white.
   * Same two-rAF pattern for a smooth transition from whatever opacity
   * the animation was at when loading ended.
   */
  function starsShowError() {
    starPaths.forEach((el, i) => {
      if (!el) return;
      el.classList.remove(LOAD_CLASSES[i]);
    });
    requestAnimationFrame(() => {
      starPaths.forEach((el) => {
        if (!el) return;
        el.classList.add(STAR_ERROR);
      });
    });
  }

  /* ── Password visibility toggle ──────────────────────────── */
  if (toggleVisBtn && intraPassword && visibilityIcon) {
    toggleVisBtn.addEventListener('click', () => {
      const isPassword = intraPassword.type === 'password';
      intraPassword.type = isPassword ? 'text' : 'password';
      visibilityIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  /* ── Auth error / success UI ──────────────────────────────── */
  function showAuthError() {
    errorBox.classList.add('visible');
    successAlert.classList.remove('visible');
  }

  function hideAuthError() {
    errorBox.classList.remove('visible');
  }

  function showSuccess() {
    successAlert.classList.add('visible');
    errorBox.classList.remove('visible');
  }

  /* ── Field validation helpers ─────────────────────────────── */

  /** Mark a field as invalid. */
  function setFieldInvalid(input, wrap) {
    if (!input || !wrap) return;
    wrap.classList.add('field-invalid');
    input.setAttribute('aria-invalid', 'true');
  }

  /** Clear the invalid state for a field. */
  function clearFieldInvalid(input, wrap) {
    if (!input || !wrap) return;
    wrap.classList.remove('field-invalid');
    input.removeAttribute('aria-invalid');
  }

  /**
   * Validate both fields.
   * Returns true when the form is ready to submit.
   * Side-effects: marks / clears field errors, moves focus to first empty field.
   */
  function validateFields() {
    const loginEmpty    = intraLogin.value.trim() === '';
    const passwordEmpty = intraPassword.value.trim() === '';

    if (loginEmpty) {
      setFieldInvalid(intraLogin, loginWrap);
    } else {
      clearFieldInvalid(intraLogin, loginWrap);
    }

    if (passwordEmpty) {
      setFieldInvalid(intraPassword, passwordWrap);
    } else {
      clearFieldInvalid(intraPassword, passwordWrap);
    }

    if (loginEmpty) {
      intraLogin.focus();
      return false;
    }
    if (passwordEmpty) {
      intraPassword.focus();
      return false;
    }

    return true;
  }

  /* Clear field error as soon as the user starts typing */
  if (intraLogin && loginWrap) {
    intraLogin.addEventListener('input', () => {
      clearFieldInvalid(intraLogin, loginWrap);
    });
  }

  if (intraPassword && passwordWrap) {
    intraPassword.addEventListener('input', () => {
      clearFieldInvalid(intraPassword, passwordWrap);
    });
  }

  /* ── Form submission ──────────────────────────────────────── */
  function handleAuthSubmit() {
    hideAuthError();
    successAlert.classList.remove('visible');

    // Run field validation first — bail without loading if invalid
    if (!validateFields()) {
      return;
    }

    // Both fields are filled: start loading
    signinBtn.disabled = true;
    starsStartLoading();

    // Simulate a ~1.2 s async auth request.
    setTimeout(() => {
      signinBtn.disabled = false;
      // ── Simulate success ──
      starsShowSuccess();
      showSuccess();

      // ── To simulate an auth error instead, comment the two lines
      //    above and uncomment the two lines below:
      // starsShowError();
      // showAuthError();
    }, 1200);
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAuthSubmit();
    });
  }

  /* ── Console API (evaluation / demo) ─────────────────────── */
  window.setState = function setState(state) {
    switch (state) {
      case 'default':
        hideAuthError();
        successAlert.classList.remove('visible');
        signinBtn.disabled = false;
        starsReset();
        clearFieldInvalid(intraLogin, loginWrap);
        clearFieldInvalid(intraPassword, passwordWrap);
        break;

      case 'error':
        signinBtn.disabled = false;
        starsShowError();
        showAuthError();
        successAlert.classList.remove('visible');
        break;

      case 'loading':
        hideAuthError();
        successAlert.classList.remove('visible');
        signinBtn.disabled = true;
        starsStartLoading();
        break;

      default:
        console.warn('[RatingSystem] Unknown state:', state);
    }
  };

})();
