/* ============================================================
   Ironside Heating & Air — interactivity
   Loaded with `defer`, so the DOM is parsed when this runs.
   Progressive enhancement: the site is fully usable without it.
   ============================================================ */

// Snap counters to their final value when motion is reduced OR when ?still is on
// (?still freezes CSS motion for screenshots; the JS count-up runs on rAF, so we
// jump it straight to the target instead of capturing a mid-count frame).
const reduceMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.documentElement.classList.contains("still");

/* ---------- Lead form: submit to Netlify Forms, confirm in place ----------
   We POST the fields to Netlify in the background (so the visitor keeps the
   polished in-page "Thanks" message instead of Netlify's generic success page),
   then reveal the confirmation. Netlify registers the form from the static HTML
   (name="quote" + data-netlify), so submissions land in the Forms dashboard. */
document.querySelectorAll("form[data-quote-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const done = form.querySelector("[data-done]");
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.textContent = "Sending…";
      button.disabled = true;
    }

    const body = new URLSearchParams(new FormData(form)).toString();
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
      .then(() => {
        if (done) done.classList.remove("hidden");
        if (button) {
          button.textContent = "Request sent";
          button.classList.add("opacity-80");
        }
      })
      .catch(() => {
        // Network hiccup: let them retry rather than silently losing the lead.
        if (button) {
          button.textContent = "Try again";
          button.disabled = false;
        }
      });
  });
});

/* ---------- Count-up for stat numbers ---------- */
function animateCount(el) {
  const target = parseFloat(el.dataset.count);
  const decimals = parseInt(el.dataset.decimals || "0", 10);
  const format = (v) =>
    decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US");

  if (reduceMotion) {
    el.textContent = format(target);
    return;
  }

  const duration = 3000;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = format(target * eased);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = format(target);
  }
  requestAnimationFrame(tick);
}

/* ---------- Reveal on scroll + trigger counters ---------- */
const revealTargets = document.querySelectorAll(".reveal, .reveal-group");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        entry.target.querySelectorAll("[data-count]").forEach((c) => {
          if (!c.dataset.done) {
            c.dataset.done = "1";
            animateCount(c);
          }
        });
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );
  revealTargets.forEach((el) => io.observe(el));
} else {
  // No observer support: just show everything.
  revealTargets.forEach((el) => el.classList.add("is-visible"));
  document.querySelectorAll("[data-count]").forEach(animateCount);
}

/* ---------- Scroll-progress bar + header shadow ---------- */
const bar = document.getElementById("progress");
const header = document.querySelector("[data-header]");
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const ratio = max > 0 ? doc.scrollTop / max : 0;
    if (bar) bar.style.transform = `scaleX(${ratio})`;
    if (header) header.classList.toggle("shadow-card", doc.scrollTop > 24);
    ticking = false;
  });
}
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* ---------- Service-area map (Leaflet + OpenStreetMap) ---------- */
const mapEl = document.getElementById("map");
if (mapEl && window.L) {
  const L = window.L;

  // Completed-project locations across the Twin Cities north metro.
  const jobs = [
    { town: "Maple Grove",   job: "Cold-climate heat-pump install", at: [45.0725, -93.4558] },
    { town: "Plymouth",      job: "Rooftop units · light commercial", at: [45.0105, -93.4555] },
    { town: "Brooklyn Park", job: "Furnace replacement",            at: [45.0941, -93.3563] },
    { town: "Osseo",         job: "Ductless mini-split zone",        at: [45.1194, -93.4022] },
    { town: "Champlin",      job: "Ductwork rebalance",             at: [45.1889, -93.3972] },
    { town: "Rogers",        job: "High-efficiency AC install",      at: [45.1888, -93.5519] },
    { town: "Maple Grove N", job: "Indoor air-quality upgrade",      at: [45.1230, -93.4870] },
  ];

  const map = L.map(mapEl, {
    scrollWheelZoom: true,
    zoomControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Custom safety-orange teardrop pin.
  const orangePin = L.divIcon({
    className: "ironside-pin",
    html:
      '<svg viewBox="0 0 24 24" width="30" height="30" fill="#FF7A00" stroke="#1A1208" stroke-width="0.6">' +
      '<path d="M12 22s7-7.6 7-13A7 7 0 1 0 5 9c0 5.4 7 13 7 13z"/>' +
      '<circle cx="12" cy="9" r="2.6" fill="#0C1A29" stroke="none"/></svg>',
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });

  const markers = jobs.map((j) =>
    L.marker(j.at, { icon: orangePin, title: j.town })
      .bindPopup(
        '<strong>' + j.town + '</strong><br><span style="color:#8DA2B8">' + j.job + "</span>"
      )
      .addTo(map)
  );

  const bounds = L.featureGroup(markers).getBounds();

  // Frame all pins, then let the visitor pan/zoom freely. Re-fit once the real
  // container size is known (after fonts/Tailwind/layout settle) so tiles fill.
  const refit = () => {
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [40, 40] });
  };
  refit();
  setTimeout(refit, 300);
  window.addEventListener("load", refit);
  window.addEventListener("resize", () => map.invalidateSize());
}
