/**
 * SVG Sanitization Utility
 * 
 * Security Layer: Prevents XSS attacks through malicious SVG content
 * Uses DOMPurify to sanitize SVG data from external sources (Gemini AI)
 */

import DOMPurify from 'dompurify';

// Configure DOMPurify for SVG content
const SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ALLOWED_TAGS: [
    'svg', 'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'defs', 'use', 'symbol', 'marker', 'linearGradient',
    'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'filter',
    'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'title',
    'desc', 'metadata'
  ],
  ALLOWED_ATTR: [
    // Geometry
    'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
    'width', 'height', 'points', 'transform',
    // Styling
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity',
    'stroke-opacity', 'fill-rule', 'clip-rule',
    // Typography
    'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
    'dominant-baseline',
    // SVG structure
    'viewBox', 'preserveAspectRatio', 'xmlns', 'xmlns:xlink',
    'version', 'id', 'class', 'style',
    // References
    'href', 'xlink:href', 'url', 'src',
    // Gradient/Pattern
    'offset', 'gradientUnits', 'gradientTransform', 'spreadMethod',
    'patternUnits', 'patternTransform',
    // Filter
    'stdDeviation', 'in', 'in2', 'mode', 'type', 'values', 'result',
    // Mask/Clip
    'mask', 'clip-path', 'maskUnits', 'maskContentUnits',
    'clipPathUnits', 'marker-start', 'marker-end', 'marker-mid',
    // Animation (allowed but restricted)
    'dur', 'begin', 'end', 'repeatCount', 'repeatDur', 'fill'
  ],
  // Block dangerous URLs
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onstart'],
  // Keep data attributes but sanitize values
  ALLOW_DATA_ATTR: false,
  // Block external references that could be used for data exfiltration
  FORBID_EXTERNALS: true,
  // Don't allow JavaScript URLs
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitize SVG string to remove potentially malicious content
 * @param svgString - Raw SVG content from external source
 * @returns Sanitized SVG string safe for rendering
 */
export function sanitizeSVG(svgString: string): string {
  if (!svgString || typeof svgString !== 'string') {
    return '';
  }

  try {
    // Use DOMPurify to sanitize
    const sanitized = DOMPurify.sanitize(svgString, SVG_CONFIG);
    
    // Additional manual checks for edge cases
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /<form/gi,
    ];

    let clean = sanitized;
    for (const pattern of dangerousPatterns) {
      clean = clean.replace(pattern, '');
    }

    return clean;
  } catch (error) {
    console.error('[Security] SVG sanitization failed:', error);
    // Return empty string on failure - fail secure
    return '';
  }
}

/**
 * Check if SVG content contains potentially dangerous elements
 * @param svgString - SVG content to check
 * @returns boolean indicating if content is safe
 */
export function isSVGSafe(svgString: string): boolean {
  if (!svgString || typeof svgString !== 'string') {
    return false;
  }

  const dangerousPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /data:text\/html/i,
    /data:text\/javascript/i,
  ];

  return !dangerousPatterns.some(pattern => pattern.test(svgString));
}

/**
 * Extract and sanitize SVG from various input formats
 * Handles raw SVG strings, JSON-encoded SVG, and base64 encoded SVG
 * @param input - Input that may contain SVG data
 * @returns Sanitized SVG string or null if invalid
 */
export function extractAndSanitizeSVG(input: unknown): string | null {
  if (!input) {
    return null;
  }

  let svgContent: string;

  // Handle different input types
  if (typeof input === 'string') {
    svgContent = input;
  } else if (typeof input === 'object') {
    // Try to extract SVG from object
    const obj = input as Record<string, unknown>;
    if (typeof obj.svg === 'string') {
      svgContent = obj.svg;
    } else if (typeof obj.content === 'string') {
      svgContent = obj.content;
    } else if (typeof obj.data === 'string') {
      svgContent = obj.data;
    } else {
      return null;
    }
  } else {
    return null;
  }

  // Trim whitespace
  svgContent = svgContent.trim();

  // Check if it's base64 encoded
  if (svgContent.startsWith('data:image/svg+xml;base64,')) {
    try {
      const base64Data = svgContent.split(',')[1];
      svgContent = atob(base64Data);
    } catch {
      console.error('[Security] Failed to decode base64 SVG');
      return null;
    }
  }

  // Check if it looks like valid SVG
  if (!svgContent.toLowerCase().includes('<svg') && !svgContent.includes('<path') && !svgContent.includes('<rect')) {
    // Might be SVG path data without wrapper - don't reject, let sanitizer handle it
    console.warn('[Security] Input may not be valid SVG:', svgContent.substring(0, 100));
  }

  // Validate before sanitizing
  if (!isSVGSafe(svgContent)) {
    console.warn('[Security] SVG contains potentially dangerous content, sanitizing...');
  }

  // Sanitize
  const sanitized = sanitizeSVG(svgContent);
  
  // Verify sanitization worked
  if (!sanitized || sanitized.length === 0) {
    console.error('[Security] SVG sanitization removed all content');
    return null;
  }

  return sanitized;
}

/**
 * Validate SVG dimensions to prevent DoS via oversized SVG
 * @param svgString - SVG content
 * @param maxWidth - Maximum allowed width in pixels
 * @param maxHeight - Maximum allowed height in pixels
 * @returns boolean indicating if dimensions are acceptable
 */
export function validateSVGDimensions(
  svgString: string, 
  maxWidth: number = 10000, 
  maxHeight: number = 10000
): boolean {
  if (!svgString) return false;

  try {
    // Extract width and height from SVG tag
    const widthMatch = svgString.match(/width=["'](\d+(?:\.\d+)?)["']/i);
    const heightMatch = svgString.match(/height=["'](\d+(?:\.\d+)?)["']/i);
    
    if (widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      
      if (width > maxWidth || height > maxHeight) {
        console.warn(`[Security] SVG dimensions too large: ${width}x${height}`);
        return false;
      }
    }

    // Check for viewBox that might indicate large canvas
    const viewBoxMatch = svgString.match(/viewBox=["'][^"']*["']/i);
    if (viewBoxMatch) {
      const viewBox = viewBoxMatch[0];
      const parts = viewBox.match(/[-\d.]+/g);
      if (parts && parts.length >= 4) {
        const vbWidth = parseFloat(parts[2]);
        const vbHeight = parseFloat(parts[3]);
        
        if (vbWidth > maxWidth || vbHeight > maxHeight) {
          console.warn(`[Security] SVG viewBox too large: ${vbWidth}x${vbHeight}`);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('[Security] Error validating SVG dimensions:', error);
    return false;
  }
}

const svgSanitizer = {
  sanitizeSVG,
  isSVGSafe,
  extractAndSanitizeSVG,
  validateSVGDimensions,
};

export default svgSanitizer;
