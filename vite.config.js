import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const PRODUCTION = mode === 'production';
  const CSP = PRODUCTION ? '' : '*:5600 *:5666 ws://*:27180';

  // Sets the CSP
  const setCsp = () => {
    return {
      name: 'html-transform',
      transformIndexHtml(html) {
        const pattern = '<%= htmlWebpackPlugin.options.templateParameters.cspDefaultSrc %>';
        // check if the pattern exists in the html, if not, throw error
        if (!html.includes(pattern)) {
          throw new Error(`Could not find pattern ${pattern} in the html file`);
        }
        html = html.replace(pattern, CSP);
        // Vite injects an inline HMR preamble in dev, which the strict script-src
        // directive would block. Never relax script-src for production builds.
        if (!PRODUCTION) {
          html = html.replace(
            "script-src 'self' 'unsafe-eval'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
          );
        }
        return html;
      },
    };
  };

  // Auto-injects /src/main.js into index.html on a new line after the one which has VITE_AUTOINJECT
  const autoInject = () => {
    return {
      name: 'html-transform',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const pattern = /<!--.*VITE_AUTOINJECT.*-->/;
          // check if the pattern exists in the html, if not, throw error
          if (!pattern.test(html)) {
            throw new Error(`Could not find pattern ${pattern} in the html file`);
          }
          return html.replace(
            pattern,
            '<!-- Vite injected! --><script type="module" src="/src/main.js"></script>'
          );
        },
      },
    };
  };

  // Return the configuration
  return {
    build: {
      // Temporary compat knob for #867/#869: the forced esbuild 0.28.x security
      // upgrade cannot lower one destructuring pattern to the old default targets.
      // Drop this once Vite can consume a patched esbuild line without overrides.
      target: 'es2022',
      rollupOptions: {
        output: {
          // aw-server-rust only exposes /js/, /css/ and /fonts/ static routes
          // (webpack-era layout); mirror it instead of Vite's default assets/.
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: info => {
            const name = (info.names && info.names[0]) || '';
            if (name.endsWith('.css')) return 'css/[name]-[hash][extname]';
            if (/\.(woff2?|ttf|otf|eot)$/.test(name)) return 'fonts/[name]-[hash][extname]';
            return 'js/[name]-[hash][extname]';
          },
        },
      },
    },
    // The same esbuild limitation affects the dev dependency optimizer.
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    plugins: [
      setCsp(),
      autoInject(),
      vue({ template: { transformAssetUrls: false } }),
      VitePWA({
        devOptions: {
          enabled: true,
        },
        manifest: {
          name: 'ActivityWatch',
          short_name: 'ActivityWatch',
          description: 'Automatically track your computer usage',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    server: {
      port: 27180,
      // TODO: Fix this.
      // Breaks a bunch of style-related stuff etc.
      // We'd need to move in the entire CSP config in here (not just the default-src) if we want to use this.
      //headers: {
      //  'Content-Security-Policy': PRODUCTION ? "default-src 'self'" : "default-src 'self' *:5666",
      //},
    },
    publicDir: './static',
    resolve: {
      alias: { '~': path.resolve(__dirname, 'src') },
    },
    define: {
      PRODUCTION,
      AW_SERVER_URL: process.env.AW_SERVER_URL,
      COMMIT_HASH: process.env.COMMIT_HASH,
      'process.env.VUE_APP_ON_ANDROID': process.env.VUE_APP_ON_ANDROID,
    },
  };
});
