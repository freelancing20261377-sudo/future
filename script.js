/**
 * FUTURE SPACE — Premium JavaScript Controller
 * Custom Cursor · Page Loader · Lenis Smooth Scroll
 * Canvas Scroll Sequences · Scroll Reveals · Mobile Menu · Form
 */

'use strict';

// Device detection — referenced throughout for frame counts, lerp speed, loader threshold
const isMobileDevice = window.matchMedia('(max-width: 768px)').matches;

// ============================================================
// 1. PAGE LOADER
// ============================================================
const loader     = document.getElementById('page-loader');
const loaderFill = document.getElementById('loader-fill');

const unlockScroll = () => {
    document.body.style.overflow = '';
    if (loader) loader.classList.add('loaded');
};

// Hard fallback — always unlock within 3s no matter what
let scrollFallback = setTimeout(unlockScroll, 3000);

const runLoader = () => {
    clearTimeout(scrollFallback);
    if (!loader || !loaderFill) {
        unlockScroll();
        return;
    }

    requestAnimationFrame(() => {
        loaderFill.style.width = '100%';
    });

    // Unlock as soon as enough frames are buffered; 3s hard cap above stays as fallback
    const minFrames = isMobileDevice ? 30 : 20;
    const checkBuffer = () => {
        const loaded = imgs1.filter(img => isReady(img)).length;
        if (loaded >= minFrames || loaded >= TOTAL_FRAMES_HERO) {
            unlockScroll();
        } else {
            requestAnimationFrame(checkBuffer);
        }
    };
    requestAnimationFrame(checkBuffer);
};

if (loader) {
    document.body.style.overflow = 'hidden';
}

if (document.readyState === 'complete') {
    runLoader();
} else {
    window.addEventListener('load', runLoader, { once: true });
}

// ============================================================
// 3. SCROLL — native only, no Lenis
// ============================================================
// Lenis is intentionally not used — native scroll is fastest.

// ============================================================
// 4. CANVAS FRAME SEQUENCES
// ============================================================
const TOTAL_FRAMES_HERO = 99;

const canvas1 = document.getElementById('sequence-canvas');
const ctx1    = canvas1 ? canvas1.getContext('2d') : null;

const heroFramePath = (i) => `images/frame_${String(i).padStart(4, '0')}.webp`;

const imgs1 = [];
const seq1  = { frame: 0 };
let tgt1 = 0;
let drawn1 = -1;

// ── Cached viewport dimensions ──────────────────────────────────────────────
// Reading window.innerWidth/Height triggers layout reflows.
// Cache once at init; refresh only on resize/orientationchange — never per frame.
let vpW = window.innerWidth;
let vpH = window.innerHeight;

const scaleDPI = (canvas, ctx) => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = vpW * dpr;
    canvas.height = vpH * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'high';
};

// Draw-rect cache: all frames share the same aspect ratio, so rw/rh/rx/ry
// are constant between resizes. Compute once, reuse every animation frame.
let drawCache = null;

const scaleAllCanvases = () => {
    vpW = window.innerWidth;   // refresh cache
    vpH = window.innerHeight;
    drawCache = null;          // invalidate — dimensions changed
    if (canvas1 && ctx1) scaleDPI(canvas1, ctx1);
};

const drawCover = (img, ctx, label = '') => {
    const cw = vpW;   // no reflow — cached
    const ch = vpH;

    if (!img || !img.complete || img.naturalWidth === 0) {
        // Luxury loading state — matches site palette, no debug text
        const grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, '#071F15');
        grad.addColorStop(1, '#0B2E20');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);
        return;
    }

    // Cache the cover rect — computed once per viewport size, not per frame
    if (!drawCache) {
        const ir = img.naturalWidth / img.naturalHeight;
        const cr = cw / ch;
        if (cr > ir) {
            drawCache = { rw: cw, rh: cw / ir, rx: 0, ry: (ch - cw / ir) / 2 };
        } else {
            drawCache = { rw: ch * ir, rh: ch, rx: (cw - ch * ir) / 2, ry: 0 };
        }
    }

    const { rw, rh, rx, ry } = drawCache;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, rx, ry, rw, rh);
};

// Frame is ready as soon as the browser has the pixel data (img.complete).
// We do NOT gate on img.decode() here — that blocked slots and made nearestLoaded
// skip over downloaded frames, causing visible jumps. decode() fires as a
// background GPU-warmup hint instead (see processQueue / initFrames below).
const isReady = (img) => img && img.complete && img.naturalWidth > 0;

// Track previous tgt1 to infer scroll direction for smarter fallback frame selection.
let prevTgt1 = 0;

// Return the nearest loaded frame, preferring frames in the direction of scroll travel.
// This prevents the animation from visually "jumping backward" when frames load out of order.
const nearestLoaded = (arr, idx, total) => {
    if (isReady(arr[idx])) return idx;
    const dir = idx >= prevTgt1 ? 1 : -1;  // +1 = scrolling forward, -1 = backward
    for (let d = 1; d < total; d++) {
        const fwd = idx + d * dir;
        const bwd = idx - d * dir;
        if (fwd >= 0 && fwd < total && isReady(arr[fwd])) return fwd;
        if (bwd >= 0 && bwd < total && isReady(arr[bwd])) return bwd;
    }
    return -1;
};

// ── Proximity-based frame loader ─────────────────────────────────────────────
// Loads frames nearest to the current scroll target first, so whatever the
// user is about to see is always downloaded before frames far from view.
const loadQueue = new Set();
let activeLoads = 0;
const MAX_CONCURRENT = isMobileDevice ? 6 : 8;

const queueFrame = (i) => {
    if (i < 0 || i >= TOTAL_FRAMES_HERO) return;
    if (imgs1[i] && (imgs1[i].src || loadQueue.has(i))) return;
    loadQueue.add(i);
};

const processQueue = () => {
    while (activeLoads < MAX_CONCURRENT && loadQueue.size > 0) {
        let best = -1, bestDist = Infinity;
        loadQueue.forEach(i => {
            const d = Math.abs(i - tgt1);
            if (d < bestDist) { bestDist = d; best = i; }
        });
        if (best === -1) break;
        loadQueue.delete(best);
        activeLoads++;
        const img = imgs1[best];
        const frameIdx = best; // snapshot — `let` rebinds each while-iteration block
        const freeSlot = () => { activeLoads--; processQueue(); };
        img.onload = () => {
            freeSlot(); // release immediately — frame is drawable as soon as data arrives
            // Fire decode() as a background GPU warmup hint (no slot held, no await).
            // At ~50KB per frame the hardware decoder resolves in <2ms — imperceptible.
            if (typeof img.decode === 'function') img.decode().catch(() => {});
        };
        img.onerror = freeSlot;
        img.src = heroFramePath(frameIdx + 1);
    }
};

const ensureNearbyFramesQueued = () => {
    const radius = isMobileDevice ? 15 : 10;
    for (let d = 0; d <= radius; d++) {
        queueFrame(tgt1 + d);
        queueFrame(tgt1 - d);
    }
    processQueue();
};

const initFrames = (arr, pathFn, ctx, canvas, total) => {
    for (let i = 0; i < total; i++) arr.push(new Image());

    // Frame 0: draw immediately on onload, free slot, warmup GPU in background.
    activeLoads++;
    arr[0].onload = () => {
        if (ctx && canvas) requestAnimationFrame(() => drawCover(arr[0], ctx));
        activeLoads--;
        processQueue();
        if (typeof arr[0].decode === 'function') arr[0].decode().catch(() => {});
    };
    arr[0].onerror = () => { activeLoads--; processQueue(); };
    arr[0].src = pathFn(1);

    // Queue all remaining frames — proximity loader will prioritise near-tgt1
    for (let i = 1; i < total; i++) queueFrame(i);
    processQueue();
};

// ============================================================
// 5. SCROLL SEQUENCE LOGIC
// ============================================================

// Cached offsets — measured once, never on scroll
let c1Top = 0, c1Height = 1;
const heroEl    = document.getElementById('hero-text-1');
const heroEls   = [1,2,3,4].map(i => document.getElementById(`hero-text-${i}`));

// Hero phase windows [start, end] as fraction of scroll progress
const HERO_PHASES = [
    [0.00, 0.28],
    [0.30, 0.55],
    [0.57, 0.80],
    [0.82, 1.00],
];

const cacheOffsets = () => {
    const vh = window.innerHeight;
    const c1 = document.querySelector('.scroll-sequence-container');
    if (c1) {
        c1Top    = c1.offsetTop;
        c1Height = c1.offsetHeight - vh;
    }
};

const computeSequences = () => {
    const sy = window.scrollY;

    // Hero sequence
    const f1 = Math.max(0, Math.min(1, (sy - c1Top) / c1Height));
    const newTgt = Math.min(TOTAL_FRAMES_HERO - 1, Math.floor(f1 * TOTAL_FRAMES_HERO));
    if (newTgt !== tgt1) { prevTgt1 = tgt1; tgt1 = newTgt; }  // track direction

    // Drive 4 text phases
    heroEls.forEach((el, i) => {
        if (!el) return;
        const [s, e] = HERO_PHASES[i];
        el.classList.toggle('active', f1 >= s && f1 <= e);
    });

    // Kick off loading for frames near the new target
    ensureNearbyFramesQueued();
};

// ============================================================
// 6. MAIN RENDER LOOP
// ============================================================
const renderLoop = () => {
    if (ctx1) {
        if (isMobileDevice) {
            // Snap directly to scroll target — 1:1 correspondence, zero lag.
            // Lerp creates visual delay on mobile; direct snap feels more responsive.
            seq1.frame = tgt1;
        } else {
            const d1 = tgt1 - seq1.frame;
            if (Math.abs(d1) > 0.05) seq1.frame += d1 * 0.22;
        }
        const r1 = Math.round(seq1.frame);
        if (r1 !== drawn1) {
            const ni = nearestLoaded(imgs1, r1, TOTAL_FRAMES_HERO);
            if (ni !== -1) { drawCover(imgs1[ni], ctx1); drawn1 = ni; }
            // If nothing loaded yet, draw loading gradient so canvas isn't transparent
            else if (drawn1 === -1) { drawCover(null, ctx1); }
        }
    }

    requestAnimationFrame(renderLoop);
};

// ============================================================
// 7. NAVIGATION
// ============================================================
const siteHeader  = document.getElementById('site-header');
const menuBtn     = document.getElementById('nav-menu-btn');
const mobileMenu  = document.getElementById('mobile-menu');

let lastScrollY = 0;
let headerScrollTicking = false;

const updateHeader = () => {
    if (!siteHeader) return;
    const sy = window.scrollY;

    // Always toggle .scrolled for visual style
    siteHeader.classList.toggle('scrolled', sy > 60);

    // Hero section height — always visible while on the hero
    const heroContainer = document.querySelector('.scroll-sequence-container');
    const heroBottom = heroContainer ? heroContainer.offsetTop + heroContainer.offsetHeight : window.innerHeight;

    if (sy < heroBottom) {
        // On the hero — always show
        siteHeader.classList.remove('nav-hidden');
    } else {
        // Past the hero — hide on scroll down, show on scroll up
        // Never hide while mobile menu is open
        const menuOpen = mobileMenu && mobileMenu.classList.contains('open');
        const scrollingDown = sy > lastScrollY + 4;
        const scrollingUp   = sy < lastScrollY - 4;
        if (scrollingDown && !menuOpen) siteHeader.classList.add('nav-hidden');
        if (scrollingUp   || menuOpen)  siteHeader.classList.remove('nav-hidden');
    }

    lastScrollY = sy;
};

if (menuBtn && mobileMenu) {
    const closeMenu = () => {
        mobileMenu.classList.remove('open');
        menuBtn.classList.remove('open');
        document.body.style.overflow = '';
        const fixedCta = document.querySelector('.mobile-fixed-cta');
        if (fixedCta) fixedCta.style.display = 'block';
    };

    menuBtn.addEventListener('click', () => {
        const open = mobileMenu.classList.toggle('open');
        menuBtn.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
        const fixedCta = document.querySelector('.mobile-fixed-cta');
        if (fixedCta) fixedCta.style.display = open ? 'none' : 'block';
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && mobileMenu.classList.contains('open')) {
            closeMenu();
        }
    });
}

// ============================================================
// 8. CSS SCROLL REVEAL (IntersectionObserver)
// ============================================================
const initReveal = () => {
    const items = document.querySelectorAll('.reveal-item, .reveal-title, .reveal-header');
    if (!items.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    items.forEach(el => observer.observe(el));
};

// ============================================================
// 9. CONTACT FORM
// ============================================================
const initForm = () => {
    const form    = document.getElementById('contact-form');
    const success = document.getElementById('form-success');
    if (!form) return;

    const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');

    // Clear error style when user modifies field
    requiredFields.forEach(field => {
        const clearError = () => field.classList.remove('error');
        field.addEventListener('input', clearError);
        field.addEventListener('change', clearError);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let hasError = false;
        let firstInvalid = null;

        requiredFields.forEach(field => {
            const value = field.value.trim();
            let isInvalid = false;

            if (!value) {
                isInvalid = true;
            } else if (field.type === 'email') {
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(value)) {
                    isInvalid = true;
                }
            }

            if (isInvalid) {
                field.classList.add('error');
                hasError = true;
                if (!firstInvalid) {
                    firstInvalid = field;
                }
            } else {
                field.classList.remove('error');
            }
        });

        if (hasError) {
            if (firstInvalid) {
                firstInvalid.focus();
            }
            return;
        }

        const btn = form.querySelector('.btn-form-submit');
        if (btn) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';
        }
        setTimeout(() => {
            if (success) success.classList.add('visible');
            form.reset();
            if (btn) { btn.style.pointerEvents = ''; btn.style.opacity = ''; }
        }, 800);
    });
};

// ============================================================
// 10. NEWSLETTER FORM
// ============================================================
function handleNewsletter(e) {
    e.preventDefault();
    const input = e.target.querySelector('input[type="email"]');
    const btn   = e.target.querySelector('button');
    if (!input || !btn) return;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#C9A96E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    input.value = '';
    input.placeholder = 'Subscribed — thank you.';
}

// ============================================================
// 11. RESIZE HANDLER
// ============================================================
let resizeTimer;
const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        scaleAllCanvases(); // also refreshes vpW/vpH cache
        cacheOffsets();
        const f1 = Math.round(seq1.frame);
        if (ctx1 && imgs1[f1]) drawCover(imgs1[f1], ctx1);
    }, 100);
};
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize); // mobile rotation

// ============================================================
// 12. SCROLL LISTENER
// ============================================================
// rAF-batched scroll — guarantees computeSequences runs at most once per animation frame,
// preventing redundant queue traversals when scroll events fire faster than 60fps.
let scrollTicking = false;
window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(() => {
            computeSequences();
            updateHeader();
            scrollTicking = false;
        });
    }
}, { passive: true });

// ============================================================
// 12.5 ACTIVE NAVIGATION HIGHLIGHTING (IntersectionObserver)
// ============================================================
const initActiveNavHighlight = () => {
    const sections = document.querySelectorAll('section[id], .scroll-sequence-container');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    const observerOptions = {
        root: null,
        rootMargin: '-35% 0px -45% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                let id = entry.target.getAttribute('id');
                if (id === 'hero-sequence') id = '';
                
                const activeHref = id ? `#${id}` : '#';

                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    link.classList.toggle('active', href === activeHref);
                });

                mobileLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    link.classList.toggle('active', href === activeHref);
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
};

// ============================================================
// 13. INIT
// ============================================================
const isMobile = () => window.innerWidth <= 768;

// ── Canvas sequence — all devices ──
scaleAllCanvases();
initFrames(imgs1, heroFramePath, ctx1, canvas1, TOTAL_FRAMES_HERO);
requestAnimationFrame(renderLoop);

// Defer layout-dependent init until the full page has rendered
const initLayout = () => requestAnimationFrame(() => {
    cacheOffsets();
    computeSequences();
});
if (document.readyState === 'complete') {
    initLayout();
} else {
    window.addEventListener('load', initLayout, { once: true });
}

initReveal();
initForm();
updateHeader();
initActiveNavHighlight();

// ============================================================
// 14. LAZY IMAGE OBSERVER — fade-in + LQIP blur-up + skeleton
// ============================================================
(() => {
    const onLoad = (img) => {
        img.classList.add('loaded');
        const wrapper = img.closest('.project-image-wrapper, .about-image-accent, .service-image, .insight-image');
        if (wrapper) wrapper.classList.add('img-loaded');
    };

    // On mobile, the hero is ~1850px tall (220vh @ 844px viewport).
    // With only 200px rootMargin, section images below the hero don't start
    // fetching until the user is 200px away — too late on slow 3G.
    // 1800px bottom margin triggers loading at page-open on mobile so images
    // are ready before the user scrolls to them.
    const lazyMargin = window.matchMedia('(max-width: 768px)').matches
        ? '0px 0px 1800px 0px'
        : '200px';

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(({ isIntersecting, target }) => {
            if (!isIntersecting) return;
            observer.unobserve(target);
            if (target.complete && target.naturalWidth > 0) {
                onLoad(target);
            } else {
                target.addEventListener('load', () => onLoad(target), { once: true });
            }
        });
    }, { rootMargin: lazyMargin });

    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
            onLoad(img);
        } else {
            observer.observe(img);
        }
    });
})();

// ============================================================
// 15. MOBILE STICKY CTA — show after hero, hide at contact
// ============================================================
(() => {
    const stickyCta = document.getElementById('mobile-sticky-cta');
    if (!stickyCta || !isTouch) return;

    const heroSection = document.querySelector('.scroll-sequence-container');
    const contactSection = document.getElementById('contact');

    let lastScrollY = 0;
    let ticking = false;

    const updateStickyCta = () => {
        const scrollY = window.scrollY;
        const heroBottom = heroSection ? heroSection.offsetTop + heroSection.offsetHeight : 600;
        const contactTop = contactSection ? contactSection.offsetTop - window.innerHeight * 0.5 : Infinity;

        if (scrollY > heroBottom && scrollY < contactTop) {
            stickyCta.classList.add('visible');
        } else {
            stickyCta.classList.remove('visible');
        }
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateStickyCta);
            ticking = true;
        }
    }, { passive: true });

    // Close sticky CTA when clicking its link
    stickyCta.querySelector('a').addEventListener('click', () => {
        stickyCta.classList.remove('visible');
    });
})();

// ============================================================
// 16. ADVANCED INTERACTIVE EFFECTS (Stats counter, Magnetic CTAs, Testimonials Drag)
// ============================================================
(() => {
    // 16.1 Stat counter animation
    const initCounter = () => {
        const statsContainer = document.querySelector('.about-stats');
        const statNums = document.querySelectorAll('.about-stat-num');
        if (!statsContainer || statNums.length === 0) return;

        const runCountUp = (el) => {
            const targetText = el.innerText || '';
            const match = targetText.match(/^([0-9]+)/);
            if (!match) return; // ignore non-numeric entries like "End-to-End"

            const targetVal = parseInt(match[1], 10);
            const suffix = targetText.slice(match[0].length);
            const supElement = el.querySelector('sup');
            const supHtml = supElement ? supElement.outerHTML : '';

            let start = 0;
            const duration = 2000; // 2 seconds
            let startTime = null;

            const animate = (timestamp) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);
                // Cubic ease-out
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const currentVal = Math.floor(easeProgress * targetVal);

                if (supHtml) {
                    el.innerHTML = `${currentVal}${supHtml}`;
                } else {
                    el.innerText = `${currentVal}${suffix}`;
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    statNums.forEach(runCountUp);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        observer.observe(statsContainer);
    };

    // 16.2 Magnetic buttons (desktop only)
    const initMagneticButtons = () => {
        if (isTouch) return; // disabled on mobile touch devices
        
        const btns = document.querySelectorAll('.btn-hero-primary, .btn-hero-ghost');
        btns.forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                
                // Suspend transition temporarily for lag-free cursor tracking
                btn.style.transition = 'none';
                
                // Pull button towards mouse by max 12px
                btn.style.transform = `translate(${x * 0.22}px, ${y * 0.22}px) translateY(-3px)`;
                btn.style.boxShadow = '0 16px 36px rgba(200, 169, 126, 0.45), 0 6px 12px rgba(0,0,0,0.2)';
                
                const content = btn.querySelector('span');
                if (content) {
                    content.style.transition = 'none';
                    content.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
                }
            });
            
            btn.addEventListener('mouseleave', () => {
                // Restore transition and original state
                btn.style.transition = '';
                btn.style.transform = '';
                btn.style.boxShadow = '';
                
                const content = btn.querySelector('span');
                if (content) {
                    content.style.transition = '';
                    content.style.transform = '';
                }
            });
        });
    };

    // 16.3 Testimonials Mouse Drag to Scroll (desktop only)
    const initTestimonialsDrag = () => {
        const track = document.querySelector('.testimonials-track');
        if (!track) return;
        
        let isDown = false;
        let startX;
        let scrollLeft;
        
        track.addEventListener('mousedown', (e) => {
            isDown = true;
            track.classList.add('active');
            startX = e.pageX - track.offsetLeft;
            scrollLeft = track.scrollLeft;
            // Temporarily disable scroll-snap during dragging so dragging is smooth
            track.style.scrollSnapType = 'none';
            track.style.cursor = 'grabbing';
        });
        
        track.addEventListener('mouseleave', () => {
            if (!isDown) return;
            isDown = false;
            track.classList.remove('active');
            track.style.scrollSnapType = '';
            track.style.cursor = '';
        });
        
        track.addEventListener('mouseup', () => {
            if (!isDown) return;
            isDown = false;
            track.classList.remove('active');
            track.style.scrollSnapType = '';
            track.style.cursor = '';
        });
        
        track.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - track.offsetLeft;
            const walk = (x - startX) * 1.5;
            track.scrollLeft = scrollLeft - walk;
        });
    };

    // Initialize all advanced effects
    initCounter();
    initMagneticButtons();
    initTestimonialsDrag();
})();