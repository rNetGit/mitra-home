// Theme toggle (remembered per browser) and the Windows / Mac tabs on the install page.
(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window: fine */ } }

  var saved = get("mitra-theme");
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector(".theme-btn");
    if (btn) btn.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark" ||
        (!root.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      set("mitra-theme", next);
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
  });
})();
