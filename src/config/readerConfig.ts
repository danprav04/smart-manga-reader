export const readerConfig = {
  defaultUrl: 'https://www.cmoa.jp/bib/speedreader/?cid=0000229254_jp_0001&u0=0',
  // Mimic modern iOS Safari (iPhone 15, iOS 17) to bypass strict browser checks
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  
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
