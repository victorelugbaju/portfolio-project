/* ============================================================
   VICTOR ELUGBAJU — PORTFOLIO
   Motion is surgical. Nothing here is decorative.
   ============================================================ */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     LOCAL CLOCK — REMOVED 2026-10-05

     The site used to show a live local time in three places: the
     hero rail, the mobile menu footer and the page footer. Victor
     asked for the clock and the location to come off the site
     entirely, so the markup and this code went with them.

     Worth knowing if it is ever wanted back: it ran on a fixed
     UTC+1 offset rather than a tz lookup, which was correct only
     because that zone observes no DST. It also held the only
     setInterval on the site — nothing ticks every second now.
     ---------------------------------------------------------- */

  /* Zero-pads to two digits. It lived inside the clock block until the
     clock was removed; the testimonial counter still needs it, so it
     stays here as a plain utility. */
  function pad(n) { return n < 10 ? '0' + n : String(n); }


  /* ----------------------------------------------------------
     SCROLL LOCK — shared

     iOS Safari ignores overflow:hidden on html/body — it is the one
     browser where the classic lock silently does nothing, and it is
     most of the audience here. Pinning the body and offsetting it by
     the scroll position is the version that actually holds; the
     offset is what stops the page jumping to the top underneath an
     overlay, and window.scrollTo puts it back on release.

     This lived inside the mobile-menu block until 2026-10-05, when the
     lightbox needed it too. It is REFERENCE-COUNTED rather than a plain
     pair of functions: two overlays that each wrote body.style.position
     directly would race, and whichever closed first would unpin the page
     while the other was still open — leaving a visitor scrolling the
     page behind a sheet they cannot dismiss. Only the outermost release
     actually restores the scroll position.
     ---------------------------------------------------------- */
  var scrollLocks = 0;
  var lockedY = 0;

  function lockScroll() {
    if (scrollLocks === 0) {
      lockedY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = (-lockedY) + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    scrollLocks++;
  }

  function unlockScroll() {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks > 0) return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedY);
  }

  /* ----------------------------------------------------------
     MOBILE NAV — the index sheet

     The whole of the visible state is one attribute: aria-expanded
     on the burger. The bars, the MENU→CLOSE swap and the sheet all
     key off it in CSS, so what a screen reader announces and what
     is drawn on screen cannot disagree. This function is the only
     place that writes it.

     Everything here degrades to nothing without JS — the sheet is
     visibility:hidden and the burger does nothing, but the desktop
     .nav__links are real anchors that are only ever hidden by a
     media query, so a script failure costs a phone visitor a nicer
     menu, never the ability to navigate.
     ---------------------------------------------------------- */
  var burger = document.getElementById('navBurger');
  var navMenu = document.getElementById('navMenu');

  if (burger && navMenu) {
    var menuOpen = false;

    var setMenu = function (open) {
      if (open === menuOpen) return;
      menuOpen = open;

      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      navMenu.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('nav-menu-open', open);

      if (open) lockScroll();
      else unlockScroll();
    };

    burger.addEventListener('click', function () { setMenu(!menuOpen); });

    /* Closing on the way out matters more than it looks. The in-page
       anchors (#work, #experience) need the scroll lock released BEFORE the
       browser acts on the hash, which is exactly what happens here:
       this handler runs to completion, then the default navigation
       lands on an unpinned page. */
    Array.prototype.forEach.call(
      navMenu.querySelectorAll('a'),
      function (link) {
        link.addEventListener('click', function () { setMenu(false); });
      }
    );

    document.addEventListener('keydown', function (e) {
      if (!menuOpen) return;

      if (e.key === 'Escape') {
        setMenu(false);
        burger.focus();
        return;
      }

      if (e.key !== 'Tab') return;

      // The sheet covers the page but is not a dialog, so nothing
      // stops Tab walking into the content behind it. Keep the ring
      // inside the sheet plus the button that opened it — read live
      // rather than cached, since the foot links differ per page.
      var focusables = [burger].concat(
        Array.prototype.slice.call(navMenu.querySelectorAll('a[href]'))
      );
      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    /* Rotating a phone to landscape can cross the breakpoint. Left
       open, the sheet would be display:none while the body was still
       pinned — a page that cannot scroll and shows no reason why. */
    var wide = window.matchMedia('(min-width: 769px)');
    var onWide = function (e) { if (e.matches) setMenu(false); };

    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);   // Safari < 14
  }


  /* ----------------------------------------------------------
     NAV — solid past the first screenful

     A fixed bar with no ground is legible over the hero and nowhere
     else. This gives it one, but only after the page has actually
     moved, so the hero keeps its full bleed on arrival. CSS scopes
     the effect to phones; the class is harmless everywhere else.
     ---------------------------------------------------------- */
  var navBar = document.querySelector('.nav');

  if (navBar) {
    var navRaf = null;
    var SOLID_AT = 24;

    var navDraw = function () {
      navRaf = null;
      navBar.classList.toggle(
        'is-solid',
        (window.scrollY || window.pageYOffset || 0) > SOLID_AT
      );
    };

    window.addEventListener('scroll', function () {
      if (!navRaf) navRaf = requestAnimationFrame(navDraw);
    }, { passive: true });

    navDraw();   // deep links and reloads can land mid-page
  }


  /* ----------------------------------------------------------
     HERO — line reveal
     Fires on the next frame rather than on window.load, so the
     type isn't held hostage by a 1.9MB portrait finishing.
     ---------------------------------------------------------- */
  // The homepage hero (#heroDisplay), the About opening statement
  // (#aboutStatement), the Contact invitation (#contactStatement), the
  // work-index header (#workStatement) and each case-study stub title
  // (#caseStatement) all use the same clipping-frame line reveal. Only one
  // exists per document; reveal whichever is present.
  var lineReveal = document.getElementById('heroDisplay') ||
                   document.getElementById('aboutStatement') ||
                   document.getElementById('contactStatement') ||
                   document.getElementById('workStatement') ||
                   document.getElementById('caseStatement');

  if (lineReveal) {
    if (reduced) {
      lineReveal.classList.add('is-in');
    } else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          lineReveal.classList.add('is-in');
        });
      });
    }
  }


  /* ----------------------------------------------------------
     HERO — portrait parallax
     ±10px against the cursor, lerped. Scale is held at 1.06 so
     the drift never exposes an edge. Pointer-driven only: no
     scroll listener, no layout thrash.
     ---------------------------------------------------------- */
  var heroPortrait = document.getElementById('heroPortrait');
  var hero = document.getElementById('hero');

  if (heroPortrait && hero && !reduced &&
      window.matchMedia('(min-width: 901px)').matches) {
    var pTargetX = 0, pTargetY = 0;
    var pCurX = 0, pCurY = 0;
    var pRaf = null;
    var DRIFT = 10;
    var P_LERP = 0.06;

    var pLoop = function () {
      pCurX += (pTargetX - pCurX) * P_LERP;
      pCurY += (pTargetY - pCurY) * P_LERP;
      heroPortrait.style.transform =
        'scale(1.06) translate3d(' + pCurX + 'px,' + pCurY + 'px,0)';

      if (Math.abs(pTargetX - pCurX) < 0.05 && Math.abs(pTargetY - pCurY) < 0.05) {
        pRaf = null;   // settle and stop; don't burn frames at rest
        return;
      }
      pRaf = requestAnimationFrame(pLoop);
    };

    document.addEventListener('mousemove', function (e) {
      // Normalised -1..1 from viewport centre, inverted so the
      // portrait leans into the cursor rather than fleeing it.
      pTargetX = ((e.clientX / window.innerWidth) - 0.5) * -2 * DRIFT;
      pTargetY = ((e.clientY / window.innerHeight) - 0.5) * -2 * DRIFT;
      if (!pRaf) pRaf = requestAnimationFrame(pLoop);
    });
  }


  /* ----------------------------------------------------------
     ABOUT PORTRAIT
     ---------------------------------------------------------- */
  var portraitImg = document.getElementById('portraitImg');
  var portraitFrame = portraitImg
    ? portraitImg.closest('.portrait__frame')
    : null;

  if (portraitImg && portraitFrame) {
    var markEmpty = function () {
      portraitFrame.classList.add('is-empty');
    };

    // Failure is the ONLY thing JS handles here. The image shows
    // itself; if it needed us to reveal it, a slow load or a
    // missed event would hide a portrait that loaded perfectly.
    portraitImg.addEventListener('error', markEmpty);

    // An error may already have fired before this script ran.
    // complete && naturalWidth === 0 is the signature of a load
    // that finished and failed.
    if (portraitImg.complete && portraitImg.naturalWidth === 0) {
      markEmpty();
    }
  }


  /* ----------------------------------------------------------
     WORK GRID — image fallbacks
     Same contract as the portrait: the images show themselves,
     JS only ever handles failure.
     ---------------------------------------------------------- */
  Array.prototype.forEach.call(
    document.querySelectorAll('.card__img'),
    function (img) {
      var frame = img.closest('.card__frame');
      if (!frame) return;

      var fail = function () { frame.classList.add('is-empty'); };

      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    }
  );


  /* ----------------------------------------------------------
     PROTOTYPE — link out, never embed

     There used to be a click-to-load Figma embed here. It's gone
     deliberately: a prototype opened inline hands the visitor to
     Figma's own UI in the middle of a case study, and getting back
     to the page means finding the edge of an iframe. The prototype
     now opens in a new tab, so the study keeps its place.

     Nothing replaces it in JS. The markup already ships a real
     anchor with target="_blank" and rel="noopener", so removing
     the upgrade leaves a working link rather than a dead control —
     which is why no markup change was needed to make this switch.

     data-proto-embed attributes still in the HTML are inert. They
     can be deleted whenever those pages are next touched.
     ---------------------------------------------------------- */


  /* ----------------------------------------------------------
     READ PROGRESS — how far down a case study you are

     Same contract as the experience rail below: scaleX on a real
     element, never width, because this writes on every scroll
     frame and width relayouts.

     Runs under reduced motion on purpose. It reports position
     rather than animating for effect — it's a scrollbar, not a
     flourish, and the global transition override already strips
     easing off it.

     Scrollable distance can be zero (a short page, a phone in
     landscape), and dividing by it would put NaN into a transform
     and blank the bar. Guard, don't assume.
     ---------------------------------------------------------- */
  var readFill = document.getElementById('readProgress');

  if (readFill) {
    var readRaf = null;

    var readDraw = function () {
      readRaf = null;

      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        readFill.style.transform = 'scaleX(0)';
        return;
      }

      var p = (window.scrollY || window.pageYOffset || 0) / scrollable;
      p = Math.min(1, Math.max(0, p));

      readFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };

    var readQueue = function () {
      if (!readRaf) readRaf = requestAnimationFrame(readDraw);
    };

    window.addEventListener('scroll', readQueue, { passive: true });
    window.addEventListener('resize', readQueue);

    // Images on a case page land after this runs and change
    // scrollHeight under it, which would leave the bar reporting a
    // page length that no longer exists.
    window.addEventListener('load', readDraw);

    readDraw();   // deep links and reloads can land mid-page
  }


  /* ----------------------------------------------------------
     VIEW BADGE — cursor-following disc
     Lerped so it trails the cursor rather than snapping to it.
     Two hosts: the homepage grid (#workGrid, .card triggers) and the
     all-projects page (#workIndex, .project__link triggers). Skips the
     reserved slots on both — .card--slot / .project--slot aren't
     projects and must not offer to be opened.
     ---------------------------------------------------------- */
  var viewBadge = document.getElementById('viewBadge');
  var badgeScope = document.getElementById('workGrid') ||
                   document.getElementById('workIndex');

  if (viewBadge && badgeScope && !reduced &&
      window.matchMedia('(min-width: 901px)').matches) {
    var bTargetX = 0, bTargetY = 0;
    var bCurX = 0, bCurY = 0;
    var bRaf = null;
    var bActive = false;
    var B_LERP = 0.16;
    var B_HALF = 46;   // half the disc, so it centres on the cursor

    var bLoop = function () {
      bCurX += (bTargetX - bCurX) * B_LERP;
      bCurY += (bTargetY - bCurY) * B_LERP;
      viewBadge.style.transform =
        'translate3d(' + bCurX + 'px,' + bCurY + 'px,0)';

      if (!bActive &&
          Math.abs(bTargetX - bCurX) < 0.1 &&
          Math.abs(bTargetY - bCurY) < 0.1) {
        bRaf = null;   // settle, then stop burning frames
        return;
      }
      bRaf = requestAnimationFrame(bLoop);
    };

    document.addEventListener('mousemove', function (e) {
      bTargetX = e.clientX - B_HALF;
      bTargetY = e.clientY - B_HALF;
      // Jump, don't glide, when it's hidden — otherwise it flies in
      // from wherever it was last parked.
      if (!bActive) { bCurX = bTargetX; bCurY = bTargetY; }
    });

    Array.prototype.forEach.call(
      badgeScope.querySelectorAll(
        '.card:not(.card--slot), .project:not(.project--slot) .project__link'
      ),
      function (card) {
        card.addEventListener('mouseenter', function () {
          bActive = true;
          viewBadge.classList.add('is-active');
          if (!bRaf) bRaf = requestAnimationFrame(bLoop);
        });

        card.addEventListener('mouseleave', function () {
          bActive = false;
          viewBadge.classList.remove('is-active');
        });
      }
    );
  }


  /* ----------------------------------------------------------
     WORDS — testimonial index

     A real tablist. One tab stop for the whole list and arrows to
     move inside it (roving tabindex) — the alternative is four tab
     stops that each look like a link and go nowhere.

     No hover-swap: it flickers the quote every time a cursor
     crosses the list on its way somewhere else. No autoplay: this
     is the one block on the page a reader is mid-sentence in, and
     moving it under them is a bug wearing a feature's clothes.
     ---------------------------------------------------------- */
  var wordsIndex = document.getElementById('wordsIndex');

  if (wordsIndex) {
    var wordsTabs = Array.prototype.slice.call(
      wordsIndex.querySelectorAll('.words__row')
    );
    var wordsPanels = wordsTabs.map(function (tab) {
      return document.getElementById(tab.getAttribute('aria-controls'));
    });
    var wordsCount = document.getElementById('wordsCount');

    var wordsSelect = function (i, moveFocus) {
      wordsTabs.forEach(function (tab, n) {
        var on = n === i;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        if (wordsPanels[n]) wordsPanels[n].classList.toggle('is-active', on);
      });

      if (wordsCount) {
        wordsCount.textContent = pad(i + 1) + ' / ' + pad(wordsTabs.length);
      }

      // Only on arrow keys. Stealing focus on click would yank the
      // page around for a mouse user who is already looking at it.
      if (moveFocus) wordsTabs[i].focus();
    };

    wordsTabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { wordsSelect(i, false); });
    });

    wordsIndex.addEventListener('keydown', function (e) {
      var i = wordsTabs.indexOf(document.activeElement);
      if (i === -1) return;

      var next;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        next = (i + 1) % wordsTabs.length;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        next = (i - 1 + wordsTabs.length) % wordsTabs.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = wordsTabs.length - 1;
      } else {
        return;
      }

      e.preventDefault();
      wordsSelect(next, true);
    });

    // Read the start state off the DOM rather than assuming slot 0 —
    // whoever fills these in may reorder them, or delete the one that
    // never gets a quote.
    var wordsStart = 0;
    wordsTabs.forEach(function (tab, n) {
      if (tab.classList.contains('is-active')) wordsStart = n;
    });
    wordsSelect(wordsStart, false);
  }


  /* ----------------------------------------------------------
     SCROLL REVEAL
     Staggered within a section, never across the whole page.
     ---------------------------------------------------------- */
  if (!reduced && 'IntersectionObserver' in window) {
    // .hero__display is deliberately absent — it runs its own line
    // reveal and keys off the same .is-in class. Two systems writing
    // one class name is a collision, not a coincidence.
    //
    // .quote is absent for the same reason: it owns its own opacity
    // for the swap. .words__stage — its parent — carries the entrance
    // instead, so the two never write the same property on the same
    // element.
    var targets = document.querySelectorAll(
      '.hero__eyebrow, .hero__rail, .section__head, ' +
      '.card, .about__portrait, .about__body, .principle, .tool, ' +
      '.words__stage, .words__row, ' +
      '.xp__row, .xp__note, .contact__display, .contact__item, ' +
      // About page (about.html) — safely empty on the homepage.
      '.about-hero__eyebrow, .about-hero__foot, .cap, .edu__row, ' +
      '.cta__display, .cta__text, .cta__actions, .cta__link-item, ' +
      // Work index + case-study stubs — safely empty elsewhere.
      '.project, .case-facts, .case-notice, ' +
      // Case study v2 — safely empty on every other page.
      //
      // .shots__item and .landed__fact are listed rather than their
      // containers so the stagger below has siblings to index: the
      // delay is computed from position among parentElement.children,
      // so revealing .shots as one block would give the whole row a
      // single delay and lose the cascade.
      //
      // .plate is deliberately absent. It's a full-bleed image and
      // the only thing on screen when it arrives — fading it in means
      // a visitor scrolls onto an empty viewport and waits for it.
      '.thesis__statement, .thesis__col, .shots__item, .process__step, ' +
      '.landed__fact, .landed__limits'
    );

    Array.prototype.forEach.call(targets, function (el) {
      el.classList.add('reveal');
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var siblings = entry.target.parentElement
          ? Array.prototype.slice.call(entry.target.parentElement.children)
          : [];
        var i = siblings.indexOf(entry.target);
        var delay = Math.min(Math.max(i, 0), 6) * 55;

        setTimeout(function () {
          entry.target.classList.add('is-in');
        }, delay);

        io.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }


  /* ----------------------------------------------------------
     EXPERIENCE — chronology progress

     The rail holds still while the timeline scrolls past it, so it
     can afford to report where in that timeline you are.

     Runs under reduced motion, deliberately. This reports position
     rather than animating for effect — it's a scrollbar, not a
     flourish, and the global transition-duration override already
     strips the easing off it.

     scaleX on a real element, never width: width relayouts, and
     this runs on every scroll frame.
     ---------------------------------------------------------- */
  var xpFill = document.getElementById('xpFill');
  var xpList = document.getElementById('xpList');
  var xpNodes = xpList
    ? xpList.querySelectorAll('.xp__node')
    : [];

  if (xpFill && xpNodes.length > 1) {
    var xpFirst = xpNodes[0];
    var xpLast = xpNodes[xpNodes.length - 1];
    var xpRaf = null;

    var xpDraw = function () {
      xpRaf = null;

      // Anchored node-to-node, not to the list's box. The bar means
      // "which job are you on": empty on the first, full on the last.
      // Measuring the box instead lets the rail's own copy and the
      // list's trailing padding into the sum, and the bar arrives
      // ~45% full before the first job is even read.
      var first = xpFirst.getBoundingClientRect().top;
      var last = xpLast.getBoundingClientRect().top;
      var span = last - first;
      if (span <= 0) return;

      // The read line sits high — a job counts as reached once it's
      // comfortably up the screen, not when it clips the bottom edge.
      var p = ((window.innerHeight * 0.42) - first) / span;
      p = Math.min(1, Math.max(0, p));

      xpFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };

    var xpQueue = function () {
      if (!xpRaf) xpRaf = requestAnimationFrame(xpDraw);
    };

    window.addEventListener('scroll', xpQueue, { passive: true });
    window.addEventListener('resize', xpQueue);
    xpDraw();
  }


  /* ----------------------------------------------------------
     CONTACT — copy to clipboard

     The email is also a mailto link, so this is pure enhancement:
     if the clipboard API is missing or denied, the link still works.
     Feedback swaps the button label and reverts after a beat.
     ---------------------------------------------------------- */
  Array.prototype.forEach.call(
    document.querySelectorAll('.channel__copy'),
    function (btn) {
      var original = btn.textContent.trim();
      var revert = null;

      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy') || '';
        if (!navigator.clipboard) return;

        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          clearTimeout(revert);
          revert = setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('is-copied');
          }, 1800);
        }).catch(function () {
          // Denied or unavailable (common over file://). No feedback,
          // but the value is still a live mailto link, so nothing broke.
        });
      });
    }
  );


  /* ----------------------------------------------------------
     CONTACT — compose a message

     No backend, so the honest move is to build a mailto draft and
     hand it to the visitor's mail client. The form keeps a plain
     action="mailto:" for the no-JS path; here we set noValidate,
     run our own checks with legible messages, and compose a cleaner
     body than enctype=text/plain would.
     ---------------------------------------------------------- */
  var contactForm = document.getElementById('contactForm');

  if (contactForm) {
    // Our validation replaces the native bubbles — but only now that
    // JS is confirmed present. With JS off, the markup's required /
    // type=email still guard the no-JS mailto submit.
    contactForm.noValidate = true;

    var fName = document.getElementById('cf-name');
    var fEmail = document.getElementById('cf-email');
    var fOrg = document.getElementById('cf-org');
    var fMessage = document.getElementById('cf-message');
    var status = document.getElementById('formStatus');
    var success = document.getElementById('formSuccess');
    var restart = document.getElementById('formRestart');
    var EMAIL_TO = 'victorajibolaelugbaju@gmail.com';

    // Deliberately loose. This catches "not an address" (no @, no dot),
    // not every RFC edge case — the only real test is whether a reply
    // bounces, and an over-strict pattern rejects valid addresses.
    var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };

    var fieldOf = function (input) { return input.closest('.field'); };

    var setError = function (input, on) {
      var field = fieldOf(input);
      if (!field) return;
      field.classList.toggle('is-error', on);
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
    };

    // Clear a field's error the moment the visitor starts fixing it —
    // nagging while someone is mid-correction is the classic form sin.
    [fName, fEmail, fMessage].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () {
        if (fieldOf(input).classList.contains('is-error')) setError(input, false);
        if (status) { status.textContent = ''; status.classList.remove('is-error'); }
      });
    });

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Validate in DOM order so the summary and the focus target agree.
      var problems = [];
      if (!fName.value.trim()) { setError(fName, true); problems.push(fName); }
      else setError(fName, false);

      if (!emailOk(fEmail.value.trim())) { setError(fEmail, true); problems.push(fEmail); }
      else setError(fEmail, false);

      if (!fMessage.value.trim()) { setError(fMessage, true); problems.push(fMessage); }
      else setError(fMessage, false);

      if (problems.length) {
        status.textContent = problems.length === 1
          ? 'One field needs a look before this can send.'
          : problems.length + ' fields need a look before this can send.';
        status.classList.add('is-error');
        problems[0].focus();
        return;
      }

      var name = fName.value.trim();
      var email = fEmail.value.trim();
      var org = fOrg && fOrg.value.trim();

      var subject = 'New message from ' + name +
        (org ? ' (' + org + ')' : '');

      var lines = [
        'Hi Victor,',
        '',
        'My name is ' + name + '.',
        '',
        fMessage.value.trim(),
        '',
        '—',
        name,
        email + (org ? ' · ' + org : '')
      ];

      var href = 'mailto:' + EMAIL_TO +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\r\n'));

      // Hand off to the mail client, then show the confirmation. The
      // draft opens in a new context; this view stays put and explains
      // what just happened.
      window.location.href = href;

      if (success) {
        contactForm.hidden = true;
        success.hidden = false;
        // Move focus to the confirmation so a keyboard or screen-reader
        // user isn't left on a now-hidden form.
        success.setAttribute('tabindex', '-1');
        success.focus();
      }
    });

    if (restart && success) {
      restart.addEventListener('click', function () {
        success.hidden = true;
        contactForm.hidden = false;
        contactForm.reset();
        status.textContent = '';
        status.classList.remove('is-error');
        fName.focus();
      });
    }
  }


  /* ----------------------------------------------------------
     LIGHTBOX — added 2026-10-05

     WHY THIS EXISTS. The case-study images are persona boards and UI
     screenshots: they carry type. Measured at a 390px viewport they are
     downscaled 7x to 14x (sprout-persona.png is 4800px wide shown at
     348px), so 40px type in the board lands near 3px on a phone. The
     evidence in a case study became decoration on the device most
     people read it on. This lets a visitor open the board full-screen
     and pinch it.

     Note srcset would NOT have fixed this. srcset reduces bytes; the
     downscale, and so the legibility, is identical.

     WHAT IT ATTACHES TO. Every .card__img inside a .card__frame, found
     live at click time rather than cached — the four case studies are
     static files that gain images as Victor exports them, and a cached
     list would silently miss any image added later.

     NOT A <dialog>. Safari only shipped showModal() in 15.4 and this
     audience skews to older iOS; a plain div with the ARIA roles works
     everywhere and costs nothing extra to manage.

     The overlay element is BUILT HERE, not written into all eight
     pages. It is one component with no per-page variation, and putting
     it in the markup would mean eight copies to keep in step — the
     exact drift the design system exists to stop. It also means
     design-system.html, which ships no JS on purpose, gets no stray
     empty overlay in its DOM.
     ---------------------------------------------------------- */
  (function lightbox() {
    // Opt out where there is nothing to enlarge.
    var frames = document.querySelectorAll('.card__frame');
    if (!frames.length) return;

    var box = null, boxImg = null, boxCap = null, closeBtn = null, stage = null;
    var lastFocus = null;

    function build() {
      box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Enlarged image');
      box.hidden = true;

      stage = document.createElement('div');
      stage.className = 'lightbox__stage';

      boxImg = document.createElement('img');
      boxImg.className = 'lightbox__img';
      boxImg.alt = '';

      boxCap = document.createElement('p');
      boxCap.className = 'lightbox__caption meta meta--mute';

      closeBtn = document.createElement('button');
      closeBtn.className = 'lightbox__close meta';
      closeBtn.type = 'button';
      closeBtn.textContent = 'Close';

      var hint = document.createElement('p');
      hint.className = 'lightbox__hint meta meta--mute';
      hint.textContent = 'Drag to explore · Esc to close';

      /* The caption and hint sit OUTSIDE the stage. The stage scrolls —
         the image is shown at natural size so it can actually be read —
         and anything inside it would scroll away with the picture. */
      stage.appendChild(boxImg);
      box.appendChild(closeBtn);
      box.appendChild(stage);
      box.appendChild(boxCap);
      box.appendChild(hint);
      document.body.appendChild(box);

      closeBtn.addEventListener('click', close);

      // Backdrop closes; the image itself must not, or a pinch-to-zoom
      // that ends on the image would dismiss what the visitor opened.
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target === stage) close();
      });

      document.addEventListener('keydown', function (e) {
        if (box.hidden) return;
        if (e.key === 'Escape') { close(); return; }
        // Only two focusables, so the trap is just: keep Tab on Close.
        if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
      });
    }

    function open(img) {
      if (!box) build();
      lastFocus = document.activeElement;

      boxImg.src = img.currentSrc || img.src;
      boxImg.alt = img.alt || '';

      // Prefer the caption next to the image; fall back to its alt text.
      var item = img.closest('.shots__item');
      var cap = item ? item.querySelector('.shots__caption') : null;
      boxCap.textContent = cap ? cap.textContent.trim() : (img.alt || '');

      box.hidden = false;
      lockScroll();

      /* SIZING. Two obvious options are both wrong, and both were built
         and measured before settling here:

           fit to viewport  — 359px on a phone against 348px inline, and
                              1056px on desktop against 1176px. The
                              "enlarged" view came out smaller than the
                              page. Pointless.
           natural size     — 3600px on a 390px screen is a 10x crop. You
                              see one letter of a heading and no way to
                              tell where you are on the board.

         So: a fixed ~3x magnification over the fitted size, capped at the
         image's own pixels so it is never upscaled into mush. On a phone
         that puts a 3600px board at about 1170px, which renders its 40px
         type near 13px — readable, and only about three screens to pan
         across. On desktop it lands at natural size for the same reason.

         Then centre the scroll, because at any zoom above fit the board
         otherwise opens on its top-left margin, which is empty on most of
         these exports and reads as a broken overlay. */
      var fitAndCentre = function () {
        var natural = boxImg.naturalWidth || 0;
        if (natural) {
          var target = Math.min(natural, Math.round(stage.clientWidth * 3));
          boxImg.style.width = target + 'px';
          boxImg.style.height = 'auto';
        }
        stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
        stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
      };
      fitAndCentre();
      // Cached images are already complete; a first view is not.
      if (!boxImg.complete) boxImg.addEventListener('load', fitAndCentre, { once: true });

      // Focus the control, not the image — the first Tab should offer
      // the way out.
      closeBtn.focus();
    }

    function close() {
      if (!box || box.hidden) return;
      box.hidden = true;
      boxImg.removeAttribute('src');
      boxImg.style.width = '';
      boxImg.style.height = '';
      unlockScroll();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* Delegated, so images that arrive later still work. A click on the
       placeholder card (the red "Image needed" state) is ignored: there
       is nothing behind it to enlarge. */
    document.addEventListener('click', function (e) {
      var img = e.target.closest ? e.target.closest('.card__frame .card__img') : null;
      if (!img) return;
      if (!img.complete || !img.naturalWidth) return;
      // Never hijack a card that is itself a link to a case study.
      if (img.closest('a')) return;
      e.preventDefault();
      open(img);
    });

    /* Keyboard parity. The frames are divs, so they are not focusable by
       default; give every enlargeable image a real control role. */
    Array.prototype.forEach.call(
      document.querySelectorAll('.card__frame .card__img'),
      function (img) {
        if (img.closest('a')) return;
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', (img.alt || 'Image') + ' — open full size');
        img.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          if (!img.complete || !img.naturalWidth) return;
          e.preventDefault();
          open(img);
        });
      }
    );
  })();

})();
