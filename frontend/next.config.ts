import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export statique : génère du HTML/JS/CSS pur dans /out, aucun serveur Node requis
  output: "export",
  trailingSlash: true,

  experimental: {
    optimizePackageImports: ['lucide-react', 'gsap'],
  },

  compress: true,

  images: {
    unoptimized: true, // obligatoire en export statique, pas d'optimisation à la volée
  },

  // NOTE: async headers() supprimé car incompatible avec output: "export".
  // Si tu veux ces en-têtes (X-Frame-Options, CSP, etc.), ajoute-les côté FastAPI
  // via un middleware qui les injecte sur chaque réponse.

  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;