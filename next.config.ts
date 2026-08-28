import type { NextConfig } from "next";

/**
 * Headers de seguranca aplicados a todas as respostas.
 *
 * A CSP e restritiva de proposito: a aplicacao nao carrega scripts, estilos ou
 * imagens de terceiros no browser. Todas as chamadas para APIs externas
 * acontecem no servidor (Route Handlers), entao `connect-src` pode ficar
 * limitado a origem propria.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' em script-src e exigido pelo runtime de hidratacao do Next
  // em modo de desenvolvimento e pelos scripts inline de bootstrap do App Router.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
