/**
 * ============================================================
 * RideZone — Vehicle360Viewer
 * True 360° Interactive Vehicle Viewer (36 frames, continuous wrap-around)
 * ============================================================
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Vehicle360Viewer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * Authoritative mapping between RideZone database vehicles and 360 folder slugs.
   * Uses database ID primarily (1 to 7) with name fallbacks.
   */
  const VEHICLE_SLUG_MAP = {
    1: "ather",
    2: "honda",
    3: "suzuki",
    4: "yamaha",
    5: "bajaj",
    6: "ktm",
    7: "kawasaki",
    8: "hunter",
    9: "tvs",
    // Name fallbacks
    "ather 450x": "ather",
    "honda activa 6g": "honda",
    "suzuki access 125": "suzuki",
    "yamaha mt-15 v2": "yamaha",
    "bajaj pulsar ns200": "bajaj",
    "ktm rc 390": "ktm",
    "kawasaki ninja 300": "kawasaki",
    "royal enfield hunter 350": "hunter",
    "royal enfield": "hunter",
    "hunter 350": "hunter",
    "hunter": "hunter",
    "tvs apache rr 310": "tvs",
    "tvs apache": "tvs",
    "tvs": "tvs"
  };

  /**
   * Helper to resolve slug from vehicle ID or name
   */
  function resolveVehicleSlug(idOrName) {
    if (!idOrName) return "ather";
    if (VEHICLE_SLUG_MAP[idOrName]) return VEHICLE_SLUG_MAP[idOrName];
    const key = String(idOrName).toLowerCase().trim();
    if (VEHICLE_SLUG_MAP[key]) return VEHICLE_SLUG_MAP[key];
    // Partial search
    for (const [k, v] of Object.entries(VEHICLE_SLUG_MAP)) {
      if (key.includes(v)) return v;
    }
    return "ather";
  }

  /**
   * Flexible path generator supporting padded and custom template naming conventions.
   * Example standard: generateImagePath('/assets/360/ktm', 1) -> '/assets/360/ktm/01.png'
   * Example custom: generateImagePath('/assets/images/ktm-rc390-360', 1, 'ktm-frame-{index}.jpg', 1) -> '/assets/images/ktm-rc390-360/ktm-frame-1.jpg'
   */
  function generateImagePath(basePath, index, pattern = "{index}.png", padTo = 2) {
    const cleanBase = (basePath || "").replace(/\/+$/, "");
    const paddedIndex = String(index).padStart(Number(padTo) || 1, "0");
    const fileName = pattern.replace("{index}", paddedIndex);
    return `${cleanBase}/${fileName}`;
  }

  class Vehicle360Viewer {
    /**
     * @param {HTMLElement|string} target - Container element or <img> selector
     * @param {Object} options - Configuration options
     */
    constructor(target, options = {}) {
      this.container = typeof target === "string" ? document.querySelector(target) : target;
      if (!this.container) {
        console.warn("[RideZone 360] Target element not found:", target);
        return;
      }

      // If target is an <img>, use its parent as container and itself as imageEl
      if (this.container.tagName === "IMG") {
        this.imgEl = this.container;
        this.container = this.imgEl.parentElement;
      } else {
        this.imgEl = this.container.querySelector("img");
        if (!this.imgEl) {
          this.imgEl = document.createElement("img");
          this.imgEl.className = "vehicle-360-frame-img";
          this.imgEl.alt = "Vehicle 360 View";
          this.container.appendChild(this.imgEl);
        }
      }

      // Options
      this.vehicleId = options.vehicleId || 1;
      this.vehicleName = options.vehicleName || "Ather 450X";
      this.slug = resolveVehicleSlug(this.vehicleId || this.vehicleName);
      this.fallbackImage = options.fallbackImage || this.imgEl.getAttribute("src") || `/assets/${this.slug}.png`;
      this.totalFrames = options.totalFrames || 36;
      this.assetBaseUrl = options.assetBaseUrl || "/assets/360/";

      // Flexible Template & Path Configuration (supports data-filename-pattern, data-folder, and data-pad-to)
      const ds = (this.container && this.container.dataset) ? this.container.dataset : {};
      this.pattern = options.pattern || ds.filenamePattern || ds.pattern || "{index}.png";
      this.padTo = options.padTo !== undefined ? options.padTo : (ds.padTo !== undefined ? parseInt(ds.padTo, 10) : 2);
      this.customFolder = options.folder || options.customFolder || ds.folder || null;

      this.pixelsPerFrame = options.pixelsPerFrame || 10; // Sensitivity: ~10px drag per frame
      this.introAutoRotate = options.introAutoRotate !== false;
      this.introRotationSpeed = options.introRotationSpeed || 48; // ms per frame
      this.introRotationLoops = options.introRotationLoops || 1;
      this.hintEl = options.hintEl || (this.container.querySelector ? this.container.querySelector(".drag-hint-badge") : null);

      // Internal State
      this.currentFrame = 1;
      this.isDragging = false;
      this.startX = 0;
      this.accumulatedDrag = 0;
      this.isIntroRunning = false;
      this.introTimer = null;
      this.hasUserInteracted = false;
      this.hasFull360 = false;
      this.loadedFramesCount = 0;
      this.frameCache = new Map(); // frameNumber -> HTMLImageElement
      this.destroyed = false;

      // Accessibility: respect reduced-motion preference
      this.prefersReducedMotion = false;
      if (typeof window !== "undefined" && window.matchMedia) {
        this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }

      this._init();
    }

    /**
     * Build URL for a specific 1-based frame index using template pattern
     */
    getFrameUrl(frameNum) {
      const basePath = this.customFolder || `${this.assetBaseUrl.replace(/\/+$/, "")}/${this.slug}`;
      return generateImagePath(basePath, frameNum, this.pattern, this.padTo);
    }

    /**
     * Initialize viewer DOM, touch-action, listeners and begin progressive loading
     */
    _init() {
      // Styling & touch optimization
      this.container.classList.add("vehicle-360-container");
      this.container.style.touchAction = "pan-y"; // Allow vertical scrolling, handle horizontal gestures
      this.container.style.cursor = "grab";
      this.container.style.userSelect = "none";
      this.container.style.webkitUserSelect = "none";

      this.imgEl.setAttribute("draggable", "false");

      // Bind Pointer & Touch handlers
      this._onPointerDown = this._handlePointerDown.bind(this);
      this._onPointerMove = this._handlePointerMove.bind(this);
      this._onPointerUp = this._handlePointerUp.bind(this);
      this._onKeyDown = this._handleKeyDown.bind(this);

      // Make container focusable for keyboard navigation
      if (!this.container.hasAttribute("tabindex")) {
        this.container.setAttribute("tabindex", "0");
      }
      this.container.setAttribute("role", "region");
      this.container.setAttribute("aria-label", `Interactive 360 degree view of ${this.vehicleName}. Use left and right arrow keys to rotate.`);

      this.container.addEventListener("pointerdown", this._onPointerDown);
      this.container.addEventListener("keydown", this._onKeyDown);

      // Start progressive asset loading
      this._loadProgressive();
    }

    /**
     * Progressive Loading Flow:
     * 1. Attempt frame 01 immediately.
     * 2. If frame 01 fails/404, gracefully fall back to existing vehicle image and log development notice.
     * 3. If frame 01 succeeds, display it right away and prefetch remaining frames (2..36) in background.
     */
    async _loadProgressive() {
      const frame01Url = this.getFrameUrl(1);

      try {
        const frame01 = await this._preloadSingleImage(frame01Url);
        if (this.destroyed) return;

        // Frame 01 is available!
        this.frameCache.set(1, frame01);
        this.loadedFramesCount = 1;
        this.imgEl.src = frame01Url;
        this._showLoadingIndicator(true);

        // Preload remaining frames 2 through 36 concurrently in background
        const promises = [];
        for (let i = 2; i <= this.totalFrames; i++) {
          const url = this.getFrameUrl(i);
          promises.push(
            this._preloadSingleImage(url)
              .then((img) => {
                if (this.destroyed) return;
                this.frameCache.set(i, img);
                this.loadedFramesCount++;
              })
              .catch((err) => {
                // Non-fatal: log dev warning as requested
                console.warn(`[RideZone 360] Missing frame ${i} for vehicle ${this.vehicleName} (slug: ${this.slug})`);
              })
          );
        }

        await Promise.allSettled(promises);
        if (this.destroyed) return;

        this._showLoadingIndicator(false);

        // Check if all 36 frames loaded successfully
        if (this.loadedFramesCount === this.totalFrames) {
          this.hasFull360 = true;
          this.container.classList.add("has-360-ready");

          // Start one-loop intro rotation if permitted
          if (this.introAutoRotate && !this.prefersReducedMotion && !this.hasUserInteracted) {
            this._startIntroRotation();
          }
        } else {
          console.warn(`[RideZone 360] Partial frame set for ${this.vehicleName}: ${this.loadedFramesCount}/${this.totalFrames} available.`);
        }
      } catch (err) {
        // Frame 01 unavailable: assets not present yet
        this.hasFull360 = false;
        this._showLoadingIndicator(false);
        console.info(`[RideZone 360] 36-frame asset sequence not yet detected for "${this.vehicleName}" at "${this.assetBaseUrl}${this.slug}/". Using verified high-res showroom image fallback.`);
        this.imgEl.src = this.fallbackImage;
      }
    }

    /**
     * Preload single image with Promise
     */
    _preloadSingleImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if ("decode" in img) {
            img.decode().then(() => resolve(img)).catch(() => resolve(img));
          } else {
            resolve(img);
          }
        };
        img.onerror = reject;
        img.src = url;
      });
    }

    /**
     * Optional subtle loading bar
     */
    _showLoadingIndicator(show) {
      let loader = this.container.querySelector(".viewer-360-loader");
      if (show) {
        if (!loader) {
          loader = document.createElement("div");
          loader.className = "viewer-360-loader";
          loader.innerHTML = `<div class="loader-track"><div class="loader-fill"></div></div>`;
          this.container.appendChild(loader);
        }
        loader.classList.add("visible");
      } else if (loader) {
        loader.classList.remove("visible");
        setTimeout(() => loader.remove(), 400);
      }
    }

    /**
     * Intro rotation: 1 single smooth loop (01 -> 36 -> 01) then stop
     */
    _startIntroRotation() {
      if (this.isIntroRunning || this.hasUserInteracted || this.destroyed) return;
      this.isIntroRunning = true;

      let loopCount = 0;
      let frame = 1;

      const step = () => {
        if (!this.isIntroRunning || this.hasUserInteracted || this.destroyed) {
          this.isIntroRunning = false;
          return;
        }

        frame++;
        if (frame > this.totalFrames) {
          frame = 1;
          loopCount++;
        }

        this._renderFrame(frame);

        if (loopCount >= this.introRotationLoops && frame === 1) {
          this.isIntroRunning = false;
          return;
        }

        this.introTimer = setTimeout(step, this.introRotationSpeed);
      };

      this.introTimer = setTimeout(step, 400); // slight initial pause for dramatic effect
    }

    /**
     * Stop intro rotation immediately
     */
    _cancelIntroRotation() {
      if (this.isIntroRunning) {
        this.isIntroRunning = false;
        if (this.introTimer) {
          clearTimeout(this.introTimer);
          this.introTimer = null;
        }
      }
    }

    /**
     * Pointer Down (Mouse, Touch, Pen)
     */
    _handlePointerDown(e) {
      // Primary mouse button or touch
      if (e.pointerType === "mouse" && e.button !== 0) return;

      this.hasUserInteracted = true;
      this._cancelIntroRotation();
      this._fadeHint();

      this.isDragging = true;
      this.startX = e.clientX;
      this.accumulatedDrag = 0;

      this.container.classList.add("is-dragging");
      this.container.style.cursor = "grabbing";

      // Bind window listeners so dragging outside container continues smoothly
      window.addEventListener("pointermove", this._onPointerMove);
      window.addEventListener("pointerup", this._onPointerUp);
      window.addEventListener("pointercancel", this._onPointerUp);

      // Prevent native image dragging
      e.preventDefault();
    }

    /**
     * Pointer Move
     */
    _handlePointerMove(e) {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.startX;
      this.startX = e.clientX;
      this.accumulatedDrag += deltaX;

      // Check if drag threshold reached for frame advance
      const framesDelta = Math.trunc(this.accumulatedDrag / this.pixelsPerFrame);
      if (framesDelta !== 0) {
        this.accumulatedDrag -= framesDelta * this.pixelsPerFrame;
        // Dragging right advances frame in one direction; dragging left in the opposite
        this._advanceFrames(-framesDelta);
      }
    }

    /**
     * Pointer Up / Cancel
     */
    _handlePointerUp() {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.container.classList.remove("is-dragging");
      this.container.style.cursor = "grab";

      window.removeEventListener("pointermove", this._onPointerMove);
      window.removeEventListener("pointerup", this._onPointerUp);
      window.removeEventListener("pointercancel", this._onPointerUp);
    }

    /**
     * Keyboard Navigation (Left/Right Arrows)
     */
    _handleKeyDown(e) {
      if (e.key === "ArrowLeft") {
        this.hasUserInteracted = true;
        this._cancelIntroRotation();
        this._fadeHint();
        this._advanceFrames(-1);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        this.hasUserInteracted = true;
        this._cancelIntroRotation();
        this._fadeHint();
        this._advanceFrames(1);
        e.preventDefault();
      }
    }

    /**
     * Frame advancement with seamless modulo wrapping: 36 -> 1 and 1 -> 36
     */
    _advanceFrames(step) {
      if (!this.hasFull360 && this.loadedFramesCount < 2) return;

      let nextFrame = ((this.currentFrame - 1 + step) % this.totalFrames + this.totalFrames) % this.totalFrames + 1;
      this._renderFrame(nextFrame);
    }

    /**
     * Display a specific frame
     */
    _renderFrame(frameNum) {
      this.currentFrame = frameNum;

      if (this.frameCache.has(frameNum)) {
        this.imgEl.src = this.frameCache.get(frameNum).src;
      } else {
        const url = this.getFrameUrl(frameNum);
        this.imgEl.src = url;
      }
    }

    /**
     * Fade out the "Drag to explore 360°" badge once user interacts
     */
    _fadeHint() {
      const hint = this.hintEl || this.container.querySelector(".drag-hint-badge");
      if (hint && !hint.classList.contains("faded")) {
        hint.classList.add("faded");
      }
    }

    /**
     * Clean up event listeners and background timers
     */
    destroy() {
      this.destroyed = true;
      this._cancelIntroRotation();

      if (this.container) {
        this.container.removeEventListener("pointerdown", this._onPointerDown);
        this.container.removeEventListener("keydown", this._onKeyDown);
      }

      window.removeEventListener("pointermove", this._onPointerMove);
      window.removeEventListener("pointerup", this._onPointerUp);
      window.removeEventListener("pointercancel", this._onPointerUp);

      this.frameCache.clear();
    }

    /**
     * Static Development Asset Validator:
     * Checks all 7 vehicles × 36 frames = 252 total expected frames.
     */
    static async validateAssets() {
      const vehicles = [
        { id: 1, name: "Ather 450X", slug: "ather" },
        { id: 2, name: "Honda Activa 6G", slug: "honda" },
        { id: 3, name: "Suzuki Access 125", slug: "suzuki" },
        { id: 4, name: "Yamaha MT-15 V2", slug: "yamaha" },
        { id: 5, name: "Bajaj Pulsar NS200", slug: "bajaj" },
        { id: 6, name: "KTM RC 390", slug: "ktm" },
        { id: 7, name: "Kawasaki Ninja 300", slug: "kawasaki" }
      ];

      console.log("=== RIDEZONE 360 ASSET VALIDATION (252 EXPECTED FRAMES) ===");
      let grandTotalFound = 0;
      const report = {};

      for (const v of vehicles) {
        let foundForVeh = 0;
        const missingFrames = [];

        for (let f = 1; f <= 36; f++) {
          const padded = String(f).padStart(2, "0");
          const url = `/assets/360/${v.slug}/${padded}.png`;
          try {
            const res = await fetch(url, { method: "HEAD" });
            if (res.ok) {
              foundForVeh++;
              grandTotalFound++;
            } else {
              missingFrames.push(padded);
            }
          } catch (e) {
            missingFrames.push(padded);
          }
        }

        report[v.name] = {
          slug: v.slug,
          found: foundForVeh,
          total: 36,
          missing: missingFrames
        };

        console.log(`${v.name}: ${foundForVeh}/36 frames detected ${foundForVeh === 36 ? "✓" : "(Missing: " + (missingFrames.length > 5 ? missingFrames.slice(0, 5).join(", ") + "..." : missingFrames.join(", ")) + ")"}`);
      }

      console.log(`\nTotal: ${grandTotalFound}/252 frames`);
      console.log("==========================================================");
      return { grandTotalFound, totalExpected: 252, report };
    }
  }

  Vehicle360Viewer.generateImagePath = generateImagePath;

  return Vehicle360Viewer;
});
