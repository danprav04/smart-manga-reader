export const readerConfig = {
  defaultUrl: 'https://www.cmoa.jp/bib/speedreader/?cid=0000229254_jp_0001&u0=0',
  // Mimic Chrome Mobile to avoid "unsupported browser" walls
  userAgent: 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36',
  
  webViewProps: {
    sharedCookiesEnabled: true,
    thirdPartyCookiesEnabled: true,
    domStorageEnabled: true,
    javaScriptEnabled: true,
  },
  
  // Optional CSS to inject. Hide any annoying UI if it conflicts with our overlay.
  injectedCSS: `
    /* You can put any specific CSS rules here to hide headers/footers */
    /* Example: 
       .header-class { display: none !important; }
    */
  `,
};
