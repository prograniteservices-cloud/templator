/**
 * Browser Compatibility Detection Utilities
 * 
 * These utilities provide feature detection and browser compatibility
 * checking for the Templetor V5 Web Dashboard.
 * 
 * @module lib/browserCompatibility
 */

/**
 * Check if the current browser supports all required features
 * @returns {boolean} True if browser is supported, false otherwise
 */
export const isBrowserSupported = (): boolean => {
  // Check for required APIs
  const hasWebSocket = typeof WebSocket !== 'undefined';
  const hasLocalStorage = typeof localStorage !== 'undefined';
  const hasBlob = typeof Blob !== 'undefined';
  const hasPromise = typeof Promise !== 'undefined';
  const hasArrayIncludes = Array.prototype.includes !== undefined;
  
  // Check for ES2020 features (optional chaining, nullish coalescing)
  const hasOptionalChaining = (() => {
    try {
      const obj: { test?: boolean } = {};
      return !!(obj?.test) === false;
    } catch {
      return false;
    }
  })();

  const hasNullishCoalescing = (() => {
    try {
      const testValue = undefined;
      return (testValue ?? 'fallback') === 'fallback';
    } catch {
      return false;
    }
  })();

  return (
    hasWebSocket &&
    hasLocalStorage &&
    hasBlob &&
    hasPromise &&
    hasArrayIncludes &&
    hasOptionalChaining &&
    hasNullishCoalescing
  );
};

/**
 * Check if a specific CSS feature is supported
 * @param {string} feature - The CSS feature to check
 * @returns {boolean} True if feature is supported, false otherwise
 */
export const supportsCSSFeature = (feature: string): boolean => {
  const div = document.createElement('div');
  
  const featureMap: Record<string, boolean | (() => boolean)> = {
    flexbox: 'flex' in div.style || 'msFlex' in div.style,
    grid: 'grid' in div.style || 'msGrid' in div.style,
    customProperties: CSS.supports('--custom', 'value'),
    backdropFilter: CSS.supports('backdrop-filter', 'blur(4px)') || 
                    CSS.supports('-webkit-backdrop-filter', 'blur(4px)'),
    aspectRatio: CSS.supports('aspect-ratio', '16/9'),
    sticky: CSS.supports('position', 'sticky') || CSS.supports('position', '-webkit-sticky'),
    transform: 'transform' in div.style,
    transition: 'transition' in div.style,
    gap: 'gap' in div.style || 'columnGap' in div.style,
  };

  const result = featureMap[feature];
  if (typeof result === 'function') {
    return result();
  }
  return result || false;
};

/**
 * Check if a specific JavaScript feature is supported
 * @param {string} feature - The JavaScript feature to check
 * @returns {boolean} True if feature is supported, false otherwise
 */
export const supportsJSFeature = (feature: string): boolean => {
  const featureMap: Record<string, boolean | (() => boolean)> = {
    arrowFunctions: (() => {
      try {
        const arrow = () => 'test';
        return arrow() === 'test';
      } catch {
        return false;
      }
    })(),
    templateLiterals: (() => {
      try {
        const name = 'World';
        return `Hello, ${name}!` === 'Hello, World!';
      } catch {
        return false;
      }
    })(),
    destructuring: (() => {
      try {
        const obj = { a: 1, b: 2 };
        const { a, b } = obj;
        return a === 1 && b === 2;
      } catch {
        return false;
      }
    })(),
    spreadOperator: (() => {
      try {
        const arr1 = [1, 2];
        const arr2 = [...arr1, 3, 4];
        return arr2.length === 4;
      } catch {
        return false;
      }
    })(),
    restOperator: (() => {
      try {
        const sum = (...args: number[]) => args.reduce((a, b) => a + b, 0);
        return sum(1, 2, 3) === 6;
      } catch {
        return false;
      }
    })(),
    optionalChaining: (() => {
      try {
        const obj = { nested: { value: 'test' } };
        return obj?.nested?.value === 'test';
      } catch {
        return false;
      }
    })(),
    nullishCoalescing: (() => {
      try {
        // Test nullish coalescing without triggering TypeScript narrowing
        return new Function('return (null ?? "default") === "default" && (0 ?? "default") === 0')();
      } catch {
        return false;
      }
    })(),
    asyncAwait: (() => {
      try {
        const asyncFn = async () => await Promise.resolve('test');
        return asyncFn() instanceof Promise;
      } catch {
        return false;
      }
    })(),
    arrayIncludes: Array.prototype.includes !== undefined,
    arrayFrom: typeof Array.from === 'function',
    objectValues: typeof Object.values === 'function',
    objectEntries: typeof Object.entries === 'function',
    objectKeys: typeof Object.keys === 'function',
    stringIncludes: String.prototype.includes !== undefined,
    stringStartsWith: String.prototype.startsWith !== undefined,
    stringEndsWith: String.prototype.endsWith !== undefined,
    stringRepeat: String.prototype.repeat !== undefined,
    padStart: String.prototype.padStart !== undefined,
    padEnd: String.prototype.padEnd !== undefined,
    promise: typeof Promise !== 'undefined',
    promiseAll: typeof Promise.all === 'function',
    promiseRace: typeof Promise.race === 'function',
    promiseFinally: typeof Promise.prototype.finally === 'function',
  };

  const result = featureMap[feature];
  if (typeof result === 'function') {
    return result();
  }
  return result || false;
};

/**
 * Check if a specific API is supported
 * @param {string} api - The API to check
 * @returns {boolean} True if API is supported, false otherwise
 */
export const supportsAPI = (api: string): boolean => {
  const apiMap: Record<string, boolean> = {
    websocket: typeof WebSocket !== 'undefined',
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    indexedDB: typeof indexedDB !== 'undefined',
    blob: typeof Blob !== 'undefined',
    fetch: typeof fetch !== 'undefined',
    promise: typeof Promise !== 'undefined',
    requestAnimationFrame: typeof requestAnimationFrame !== 'undefined',
    cancelAnimationFrame: typeof cancelAnimationFrame !== 'undefined',
    performance: typeof performance !== 'undefined',
    pointerEvents: typeof PointerEvent !== 'undefined',
    touchEvents: typeof TouchEvent !== 'undefined',
    mouseEvents: typeof MouseEvent !== 'undefined',
    wheelEvents: typeof WheelEvent !== 'undefined',
    intersectionObserver: typeof IntersectionObserver !== 'undefined',
    mutationObserver: typeof MutationObserver !== 'undefined',
    resizeObserver: typeof ResizeObserver !== 'undefined',
    geolocation: typeof navigator?.geolocation !== 'undefined',
    webWorkers: typeof Worker !== 'undefined',
    serviceWorkers: typeof navigator?.serviceWorker !== 'undefined',
  };

  return apiMap[api] || false;
};

/**
 * Get basic browser information
 * @returns {BrowserInfo} Browser information object
 */
export const getBrowserInfo = (): BrowserInfo => {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ),
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
  };
};

/**
 * Check if the browser supports all features required for a specific component
 * @param {string} componentName - The component name
 * @returns {ComponentSupport} Component support information
 */
export const supportsComponent = (componentName: string): ComponentSupport => {
  const componentRequirements: Record<string, { features: string[]; apis: string[]; css: string[] }> = {
    BlueprintVisualization: {
      features: ['asyncAwait', 'optionalChaining', 'spreadOperator'],
      apis: ['pointerEvents', 'wheelEvents'],
      css: ['flexbox', 'transform', 'transition'],
    },
    Dashboard: {
      features: ['arrayIncludes', 'destructuring', 'spreadOperator'],
      apis: ['localStorage', 'fetch'],
      css: ['flexbox', 'grid', 'sticky'],
    },
    JobDetail: {
      features: ['asyncAwait', 'arrayIncludes'],
      apis: ['websocket', 'localStorage'],
      css: ['flexbox', 'grid'],
    },
  };

  const requirements = componentRequirements[componentName];
  
  if (!requirements) {
    return {
      supported: true,
      missingFeatures: [],
      missingApis: [],
      missingCss: [],
    };
  }

  const missingFeatures = requirements.features.filter(f => !supportsJSFeature(f));
  const missingApis = requirements.apis.filter(a => !supportsAPI(a));
  const missingCss = requirements.css.filter(c => !supportsCSSFeature(c));

  return {
    supported: missingFeatures.length === 0 && missingApis.length === 0 && missingCss.length === 0,
    missingFeatures,
    missingApis,
    missingCss,
  };
};

/**
 * Get a browser compatibility report
 * @returns {CompatibilityReport} Full compatibility report
 */
export const getCompatibilityReport = (): CompatibilityReport => {
  const browserSupported = isBrowserSupported();
  const browserInfo = getBrowserInfo();
  
  // Check critical features
  const criticalFeatures = [
    'websocket',
    'localStorage',
    'blob',
    'fetch',
    'promise',
  ];
  
  const missingCriticalFeatures = criticalFeatures.filter(f => !supportsAPI(f));
  
  // Check component support
  const dashboardSupport = supportsComponent('Dashboard');
  const blueprintSupport = supportsComponent('BlueprintVisualization');
  const jobDetailSupport = supportsComponent('JobDetail');
  
  // Check CSS features
  const cssFeatures = {
    flexbox: supportsCSSFeature('flexbox'),
    grid: supportsCSSFeature('grid'),
    customProperties: supportsCSSFeature('customProperties'),
    backdropFilter: supportsCSSFeature('backdropFilter'),
    aspectRatio: supportsCSSFeature('aspectRatio'),
    sticky: supportsCSSFeature('sticky'),
  };
  
  // Check JS features
  const jsFeatures = {
    optionalChaining: supportsJSFeature('optionalChaining'),
    nullishCoalescing: supportsJSFeature('nullishCoalescing'),
    asyncAwait: supportsJSFeature('asyncAwait'),
    arrowFunctions: supportsJSFeature('arrowFunctions'),
    destructuring: supportsJSFeature('destructuring'),
  };

  return {
    browserSupported,
    browserInfo,
    missingCriticalFeatures,
    components: {
      dashboard: dashboardSupport,
      blueprint: blueprintSupport,
      jobDetail: jobDetailSupport,
    },
    cssFeatures,
    jsFeatures,
    recommendation: browserSupported 
      ? 'Your browser is fully supported.' 
      : 'Please upgrade your browser to use Templetor V5.',
  };
};

/**
 * Browser information interface
 */
export interface BrowserInfo {
  userAgent: string;
  language: string;
  platform: string;
  isMobile: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
}

/**
 * Component support interface
 */
export interface ComponentSupport {
  supported: boolean;
  missingFeatures: string[];
  missingApis: string[];
  missingCss: string[];
}

/**
 * Compatibility report interface
 */
export interface CompatibilityReport {
  browserSupported: boolean;
  browserInfo: BrowserInfo;
  missingCriticalFeatures: string[];
  components: {
    dashboard: ComponentSupport;
    blueprint: ComponentSupport;
    jobDetail: ComponentSupport;
  };
  cssFeatures: Record<string, boolean>;
  jsFeatures: Record<string, boolean>;
  recommendation: string;
}
