export const THEME_KEY = "sf-theme";

export const THEME_COLOR = { light: "#f2f0ea", dark: "#121211" };

/** Runs before paint so the chalk room or the dark floor is already on. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var dark=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.style.colorScheme=dark?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",dark?"${THEME_COLOR.dark}":"${THEME_COLOR.light}");}catch(e){}})();`;
