(function(){
  "use strict";

  /* ---------- reveal: лёгкое проявление, каскадом от hero вниз ---------- */
  document.documentElement.classList.add("js");
  function revealAll(){
    var els = document.querySelectorAll(".rv");
    els.forEach(function(el, i){
      setTimeout(function(){ el.classList.add("on"); }, 160 + Math.min(i * 55, 900));
    });
  }
  if (document.readyState === "complete") { revealAll(); }
  else { window.addEventListener("load", revealAll); }

/* ---------- мобильное меню ---------- */
  var nav = document.getElementById("nav");
  var burger = document.getElementById("burger");
  var mmenu = document.getElementById("mmenu");
  burger.addEventListener("click", function(){
    var open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  });
  mmenu.querySelectorAll("a").forEach(function(a){
    a.addEventListener("click", function(){
      nav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    });
  });

  /* ---------- форма: без реального submit ---------- */
  var form = document.getElementById("lead-form");
  var ok = document.getElementById("form-ok");
  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    var name = document.getElementById("f-name");
    var contact = document.getElementById("f-contact");
    var valid = true;
    [name, contact].forEach(function(inp){
      if (!inp.value.trim()) {
        inp.style.borderBottomColor = "#F97316";
        inp.focus();
        valid = false;
      } else {
        inp.style.borderBottomColor = "";
      }
    });
    if (!valid) return;
    var num = "A-" + String(Math.floor(100 + Math.random() * 900));
    ok.querySelector(".mk").textContent = "Заявка " + num + " принята";
    form.classList.add("sent");
    ok.classList.add("show");
  });
})();
