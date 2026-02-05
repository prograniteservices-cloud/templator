/**
 * Security Audit Logger
 * 
 * Security Layer: Tracks security events for incident detection and forensics
 * Logs authentication, data access, and security-related operations
 */

// Security event types
export type SecurityEventType = 
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_FAILED'
  | 'DATA_ACCESS'
  | 'DATA_MODIFY'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'VALIDATION_FAILED'
  | 'SVG_SANITIZATION_FAILED'
  | 'SVG_DANGEROUS_CONTENT_DETECTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'API_ERROR';

// Security log entry structure
interface SecurityLogEntry {
  timestamp: string;
  event: SecurityEventType;
  userId: string | null;
  sessionId: string | null;
  details: Record<string, unknown>;
  userAgent: string;
  url: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// In-memory log buffer (for batching)
const logBuffer: SecurityLogEntry[] = [];
const MAX_BUFFER_SIZE = 50;
const FLUSH_INTERVAL_MS = 30000; // Flush every 30 seconds

/**
 * Generate a session ID for tracking
 */
function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  
  let sessionId = sessionStorage.getItem('security_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('security_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Get current user ID from auth
 */
function getCurrentUserId(): string | null {
  // This will be populated from your auth context
  // For now, return null or check localStorage
  if (typeof window === 'undefined') return null;
  
  try {
    // Check for Firebase auth user
    const authUser = localStorage.getItem('firebase:authUser');
    if (authUser) {
      const parsed = JSON.parse(authUser);
      return parsed?.uid || null;
    }
  } catch {
    // Ignore parsing errors
  }
  
  return null;
}

/**
 * Determine severity level for an event
 */
function getSeverity(event: SecurityEventType): SecurityLogEntry['severity'] {
  const severityMap: Record<SecurityEventType, SecurityLogEntry['severity']> = {
    'AUTH_LOGIN': 'info',
    'AUTH_LOGOUT': 'info',
    'AUTH_FAILED': 'warning',
    'DATA_ACCESS': 'info',
    'DATA_MODIFY': 'info',
    'PERMISSION_DENIED': 'warning',
    'RATE_LIMIT_EXCEEDED': 'warning',
    'VALIDATION_FAILED': 'warning',
    'SVG_SANITIZATION_FAILED': 'error',
    'SVG_DANGEROUS_CONTENT_DETECTED': 'error',
    'SUSPICIOUS_ACTIVITY': 'error',
    'API_ERROR': 'warning',
  };
  
  return severityMap[event] || 'info';
}

/**
 * Log a security event
 * @param event - Type of security event
 * @param source - Component or function that triggered the event
 * @param details - Additional context about the event
 */
export function logSecurityEvent(
  event: SecurityEventType,
  source: string,
  details: Record<string, unknown> = {}
): void {
  if (typeof window === 'undefined') {
    // Server-side: log to console only
    console.log('[Security]', { event, source, details });
    return;
  }

  const entry: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    details: {
      ...details,
      source,
    },
    userAgent: navigator.userAgent,
    url: window.location.href,
    severity: getSeverity(event),
  };

  // Add to buffer
  logBuffer.push(entry);

  // Console log for development
  console.log(`[Security ${entry.severity.toUpperCase()}]`, {
    event: entry.event,
    userId: entry.userId,
    details: entry.details,
  });

  // Flush if buffer is full
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushSecurityLogs();
  }
}

/**
 * Flush buffered logs to storage
 * In production, this would send to a secure logging endpoint
 */
function flushSecurityLogs(): void {
  if (logBuffer.length === 0) return;

  // In production, send to your logging service
  // For now, store in localStorage for debugging
  try {
    const existingLogs = JSON.parse(localStorage.getItem('security_logs') || '[]');
    const allLogs = [...existingLogs, ...logBuffer];
    
    // Keep only last 1000 entries
    const trimmedLogs = allLogs.slice(-1000);
    localStorage.setItem('security_logs', JSON.stringify(trimmedLogs));
    
    // Clear buffer
    logBuffer.length = 0;
  } catch (error) {
    console.error('[Security] Failed to flush logs:', error);
  }
}

/**
 * Get all security logs from localStorage
 */
export function getSecurityLogs(): SecurityLogEntry[] {
  if (typeof window === 'undefined') return [];
  
  try {
    return JSON.parse(localStorage.getItem('security_logs') || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear security logs
 */
export function clearSecurityLogs(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('security_logs');
  } catch (error) {
    console.error('[Security] Failed to clear logs:', error);
  }
}

/**
 * Report security event to external service
 * Use this for critical security incidents
 */
export async function reportSecurityIncident(
  event: SecurityEventType,
  details: Record<string, unknown>
): Promise<void> {
  // Log locally first
  logSecurityEvent(event, 'incident-report', details);
  
  // In production, send to security monitoring service
  // Example: Sentry, Datadog, or custom endpoint
  
  if (process.env.NODE_ENV === 'production') {
    try {
      // TODO: Replace with your security endpoint
      // await fetch('/api/security/report', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ event, details, timestamp: new Date().toISOString() }),
      // });
    } catch (error) {
      console.error('[Security] Failed to report incident:', error);
    }
  }
}

// Auto-flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushSecurityLogs();
  });

  // Periodic flush
  setInterval(flushSecurityLogs, FLUSH_INTERVAL_MS);
}

const securityLogger = {
  logSecurityEvent,
  getSecurityLogs,
  clearSecurityLogs,
  reportSecurityIncident,
};

export default securityLogger;
