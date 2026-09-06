/* De app draait volledig in de browser, maar deze ene pagina niet: die wordt bij
   het bouwen uitgetekend. Anders krijgt een zoekmachine een lege schil van vier
   kilobyte te zien. Alles wat de browser nodig heeft staat in onMount en draait
   dus niet mee. */
export const prerender = true;
export const ssr = true;
