// Theme toggle (remembered per browser), the Windows / Mac tabs on the install page, and the home page tour video.
(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window: fine */ } }

  var saved = get("mitra-theme");
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  document.addEventListener("DOMContentLoaded", function () {
    // The button says "Dark theme" and is pressed while the page is dark, whether chosen here or by the system.
    var btn = document.querySelector(".theme-btn");
    var system = window.matchMedia("(prefers-color-scheme: dark)");
    function isDark() {
      return root.getAttribute("data-theme") === "dark" || (!root.getAttribute("data-theme") && system.matches);
    }
    function mark() { if (btn) btn.setAttribute("aria-pressed", isDark() ? "true" : "false"); }
    mark();
    if (system.addEventListener) system.addEventListener("change", mark);
    if (btn) btn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      set("mitra-theme", next);
      mark();
    });

    document.querySelectorAll("[role=tablist]").forEach(function (list) {
      var tabs = list.querySelectorAll("[role=tab]");
      function show(tab) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", on ? "true" : "false");
          document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
        });
        set("mitra-os", tab.id);
      }
      tabs.forEach(function (t) { t.addEventListener("click", function () { show(t); }); });
      document.querySelectorAll("[data-os]").forEach(function (a) {
        a.addEventListener("click", function () { var t = document.getElementById(a.getAttribute("data-os")); if (t && list.contains(t)) show(t); });
      });
      var want = document.getElementById(get("mitra-os") || "");
      if (!want && /Mac/i.test(navigator.platform || "")) want = document.getElementById("tab-mac");
      if (want && list.contains(want)) show(want);
    });

    // The tour video loads and plays (muted) only while it is on screen, and never by itself for reduced motion.
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll("video[data-autoplay]").forEach(function (v) {
      if (still || !("IntersectionObserver" in window)) return;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () { /* blocked: the controls still work */ }); }
          else v.pause();
        });
      }, { threshold: 0.4 }).observe(v);
    });
  });
})();
