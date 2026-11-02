/**
 * Rate Limiting and Client IP extraction utilities.
 * 
 * In standard reverse-proxy architectures (Vercel, Cloudflare, AWS ALB, Nginx):
 * - Platform-specific headers (cf-connecting-ip, x-vercel-forwarded-for, true-client-ip, x-real-ip)
 *   are injected by trusted edge infrastructure and stripped/overwritten from incoming client requests.
 * - Standard X-Forwarded-For header has format: "<client>, <proxy1>, <proxy2>".
 *   The true client IP is the LEFTMOST entry (parts[0]). Using the rightmost IP points to internal
 *   reverse-proxy / load balancer IPs, causing all users routed through that proxy to share the same IP
 *   and prematurely throttle legitimate fans.
 */

function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  // Basic IPv4 check: 4 octets 0-255
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  // Basic IPv6 check
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$|^::$|^::1$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export function getClientIp(req: Request): string {
  // 1. Cloudflare Connecting IP (authoritative edge header when behind Cloudflare)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && isValidIp(cfIp.trim())) {
    return cfIp.trim();
  }

  // 2. Vercel Forwarded-For (authoritative edge header on Vercel)
  const vercelXff = req.headers.get("x-vercel-forwarded-for");
  if (vercelXff) {
    const firstVercel = vercelXff.split(",")[0]?.trim();
    if (firstVercel && isValidIp(firstVercel)) {
      return firstVercel;
    }
  }

  // 3. True-Client-IP (Cloudflare Enterprise / Akamai)
  const trueClientIp = req.headers.get("true-client-ip");
  if (trueClientIp && isValidIp(trueClientIp.trim())) {
    return trueClientIp.trim();
  }

  // 4. X-Real-IP (set by Nginx / AWS ALB reverse proxy to the direct remote address)
  const realIp = req.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  // 5. Standard X-Forwarded-For: Client IP is the LEFTMOST entry
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length > 0 && isValidIp(parts[0])) {
      return parts[0];
    }
  }

  return "127.0.0.1";
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  maxEntries?: number;
}

export class BoundedRateLimiter {
  private ipMap = new Map<string, { count: number; expiresAt: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.maxEntries = config.maxEntries || 500;
  }

  public check(ip: string): boolean {
    const now = Date.now();

    // Periodic prune if map exceeds size bound
    if (this.ipMap.size > this.maxEntries) {
      for (const [key, record] of this.ipMap.entries()) {
        if (record.expiresAt < now) {
          this.ipMap.delete(key);
        }
      }
      // If still above threshold, delete oldest
      if (this.ipMap.size > this.maxEntries) {
        const oldestKey = this.ipMap.keys().next().value;
        if (oldestKey) this.ipMap.delete(oldestKey);
      }
    }

    const record = this.ipMap.get(ip);
    if (!record || record.expiresAt < now) {
      this.ipMap.set(ip, { count: 1, expiresAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }
}
