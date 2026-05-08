import { resolve } from "node:path";
import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development" && process.env.VERCEL !== "1") {
  void import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  });
}

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  process.env.NODE_ENV === "development" ? "'unsafe-eval'" : "",
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://ssl.google-analytics.com",
  "https://hm.baidu.com",
  "https://zz.bdstatic.com",
  "https://hmcdn.baidu.com",
  "https://plausible.io",
  "https://cloud.umami.is",
  "https://analytics.umami.is",
  "https://cdn.usefathom.com",
  "https://static.cloudflareinsights.com",
  "https://static.hotjar.com",
  "https://script.hotjar.com",
  "https://js.hs-scripts.com",
  "https://cdn.segment.com",
  ...(process.env.NEXT_PUBLIC_CUSTOM_SCRIPT_HOSTS || "")
    .split(",")
    .map((host) => host.trim().replace(/^https?:\/\//, "").split("/")[0])
    .filter((host) => /^[a-z0-9.-]+$/i.test(host))
    .map((host) => `https://${host}`),
].filter(Boolean).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "media-src 'self' blob: https:",
  "frame-src https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // 图片优化（Cloudflare 有自己的优化）
  images: {
    unoptimized: true,
  },

  turbopack: {
    root: resolve(process.cwd()),
  },

  // 移除客户端环境变量暴露（安全风险）
  // 敏感信息应该只在服务端使用

  // 减少构建时的 worker 数量，避免 MaxListenersExceededWarning
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
