/* Browser adapter for the owner's @solar/ui/motion reveal engine.
 * Source: bangnt188/component-ui/src/motion/{engine,stagger,tokens}.ts
 * Maintains upstream data attributes, easing, observer thresholds, once/stagger,
 * lifecycle behavior, focus reveal and reduced-motion handling.
 * This static website cannot resolve the private @solar/ui package directly.
 */
(() => {
  "use strict";

  const motionTokens = {
    stagger: { micro: 30, tight: 60, normal: 90, relaxed: 120, cap: 360 }
  };
  const numeric = (value) => {
    if (value == null || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const boolean = (value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
  };
  function getRevealStaggerIndex(index, count, order = "forward") {
    if (!Number.isFinite(index) || !Number.isFinite(count) || count <= 0) return 0;
    const safeCount = Math.max(1, Math.floor(count));
    const safeIndex = Math.min(Math.max(0, Math.floor(index)), safeCount - 1);
    if (order === "reverse") return safeCount - 1 - safeIndex;
    if (order === "center-out") {
      const center = (safeCount - 1) / 2;
      return Math.abs(safeIndex - center) - (safeCount % 2 === 0 ? 0.5 : 0);
    }
    return safeIndex;
  }
  function getRevealStaggerDelay(index, count, stagger, delayCap, order) {
    return Math.min(
      getRevealStaggerIndex(index, count, order) * Math.max(0, stagger),
      Math.max(0, delayCap)
    );
  }

  class RevealEngine {
    constructor(options = {}) {
      this.options = {
        selector: options.selector ?? "[data-reveal]",
        scopeSelector: options.scopeSelector ?? "[data-reveal-scope]",
        threshold: options.threshold ?? 0.12,
        rootMargin: options.rootMargin ?? "0px 0px -8% 0px",
        once: options.once ?? true,
        readyClass: "ui-reveal-ready",
        revealedClass: "revealed",
        registeredAttribute: "data-reveal-registered"
      };
      this.observer = null;
      this.observed = new Set();
      this.cleanups = [];
      this.query = null;
    }

    collect(root = document) {
      const elements = [];
      if (root instanceof HTMLElement && root.matches(this.options.selector)) {
        elements.push(root);
      }
      elements.push(...root.querySelectorAll(this.options.selector));
      return elements;
    }

    prefersReducedMotion() {
      return (this.query ?? window.matchMedia("(prefers-reduced-motion: reduce)")).matches;
    }

    ensureObserver() {
      if (this.observer) return;
      this.observer = new IntersectionObserver((entries) => {
        if (document.hidden) return;
        for (const entry of entries) {
          const element = entry.target;
          const once = this.resolveOnce(element);
          if (entry.isIntersecting) {
            this.revealElement(element);
          } else if (!once) {
            element.classList.remove(this.options.revealedClass);
          }
        }
      }, {
        threshold: this.options.threshold,
        rootMargin: this.options.rootMargin
      });
    }

    resolveOnce(element) {
      const own = boolean(element.dataset.revealOnce);
      if (own !== undefined) return own;
      const scope = element.closest(this.options.scopeSelector);
      return boolean(scope?.dataset.revealOnce) ?? this.options.once;
    }

    revealElement(element) {
      element.classList.add(this.options.revealedClass);
      if (this.resolveOnce(element)) this.observer?.unobserve(element);
    }

    applyTiming(element) {
      const { revealDelay, revealDuration, revealStartOpacity } = element.dataset;
      const duration = numeric(revealDuration);
      const startOpacity = numeric(revealStartOpacity);
      const explicitDelay = numeric(revealDelay);
      if (duration !== undefined) {
        element.style.setProperty("--ui-reveal-duration", Math.max(0, duration) + "ms");
      }
      if (startOpacity !== undefined) {
        element.style.setProperty("--ui-reveal-start-opacity", String(Math.max(0, Math.min(1, startOpacity))));
      }
      if (explicitDelay !== undefined) {
        element.style.setProperty("--ui-reveal-delay", Math.max(0, explicitDelay) + "ms");
        return;
      }
      const scope = element.closest(this.options.scopeSelector);
      if (!scope) return;
      const items = [...scope.querySelectorAll(this.options.selector)]
        .filter(item => item.closest(this.options.scopeSelector) === scope);
      const index = items.indexOf(element);
      if (index < 0) return;
      const stagger = Math.max(0, numeric(scope.dataset.revealStagger) ?? motionTokens.stagger.normal);
      const cap = Math.max(0, numeric(scope.dataset.revealDelayCap) ?? motionTokens.stagger.cap);
      const delay = getRevealStaggerDelay(index, items.length, stagger, cap, scope.dataset.revealOrder ?? "forward");
      element.style.setProperty("--ui-reveal-delay", delay + "ms");
    }

    register(root = document) {
      for (const element of this.collect(root)) {
        this.applyTiming(element);
        if (this.prefersReducedMotion()) {
          element.classList.add(this.options.revealedClass);
        }
        if (element.hasAttribute(this.options.registeredAttribute)) continue;
        element.setAttribute(this.options.registeredAttribute, "true");
        this.observed.add(element);
        if (!this.prefersReducedMotion()) this.observer?.observe(element);
      }
    }

    revealVisible() {
      for (const element of this.observed) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) this.revealElement(element);
      }
    }

    start() {
      if (!("IntersectionObserver" in window) || !("matchMedia" in window)) return this;
      document.documentElement.classList.add(this.options.readyClass);
      this.query = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (!this.prefersReducedMotion()) this.ensureObserver();
      this.register(document);

      const onFocus = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const element = target.closest(this.options.selector);
        if (element) this.revealElement(element);
      };
      document.addEventListener("focusin", onFocus);
      this.cleanups.push(() => document.removeEventListener("focusin", onFocus));

      const onMotionChange = () => {
        if (this.prefersReducedMotion()) {
          this.observer?.disconnect();
          this.observer = null;
          for (const element of this.observed) this.revealElement(element);
        } else {
          this.ensureObserver();
          for (const element of this.observed) {
            if (!element.classList.contains(this.options.revealedClass)) this.observer?.observe(element);
          }
        }
      };
      this.query.addEventListener?.("change", onMotionChange);
      this.cleanups.push(() => this.query?.removeEventListener?.("change", onMotionChange));

      const onVisible = () => { if (!document.hidden) this.revealVisible(); };
      document.addEventListener("visibilitychange", onVisible);
      this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
      return this;
    }

    destroy() {
      this.observer?.disconnect();
      this.cleanups.forEach(cleanup => cleanup());
      for (const el of this.observed) el.removeAttribute(this.options.registeredAttribute);
      this.observed.clear();
      document.documentElement.classList.remove(this.options.readyClass);
    }
  }

  const initRevealEngine = (options = {}) => new RevealEngine(options).start();
  const boot = () => {
    try {
      window.solarRevealEngine = initRevealEngine();
    } catch (error) {
      // Content stays fully visible if the enhancement fails.
      document.documentElement.classList.remove("ui-reveal-ready");
      console.error("Solar motion could not initialize", error);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
