export const THEME_STORAGE_KEY = "sprintwise-theme";

/**
 * Inlined in <head> so it runs before first paint and the page never flashes
 * the wrong theme. Tiny and dependency-free on purpose.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
