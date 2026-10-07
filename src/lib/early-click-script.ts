/**
 * Inlined in <head>. A page is visible a moment before React makes its
 * buttons work, and a click in that moment would do nothing. This keeps the
 * last button clicked then, shows a busy cursor, and clicks it again once
 * React owns it. After React starts, it removes itself; React handles clicks
 * from then on, so nothing is clicked twice. It gives up after 10 seconds.
 * Tiny and dependency-free on purpose, like the theme script.
 */
export const EARLY_CLICK_SCRIPT = `(function(){var d=document,r=d.documentElement,q=null,t=0;function has(o,p){return Object.keys(o).some(function(k){return k.indexOf(p)===0})}function done(){clearInterval(t);t=0;q=null;r.style.cursor=""}function onClick(e){if(has(d,"__reactContainer$")){d.removeEventListener("click",onClick,true);return}var b=e.target&&e.target.closest?e.target.closest("button"):null;if(!b||b.disabled||!e.isTrusted)return;e.preventDefault();q=b;r.style.cursor="progress";if(t)return;var s=Date.now();t=setInterval(function(){if(!d.contains(q)||Date.now()-s>10000)return done();if(has(d,"__reactContainer$")&&has(q,"__reactProps$")){var b=q;done();if(!b.disabled)b.click()}},25)}d.addEventListener("click",onClick,true)})()`;
