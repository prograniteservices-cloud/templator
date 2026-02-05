"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import type { BlueprintData, BlueprintDataObject, JobStatus } from '@/types/job';
import { extractAndSanitizeSVG, isSVGSafe } from '@/lib/svg-sanitizer';
import { logSecurityEvent } from '@/lib/security-logger';

interface BlueprintVisualizationProps {
  blueprintData: BlueprintData;
  jobStatus?: JobStatus;
  width?: number;
  height?: number;
}

function isBlueprintObject(data: BlueprintData): data is BlueprintDataObject {
  if (!data || typeof data !== 'object') return false;
  const obj = data as BlueprintDataObject;
  return (
    Array.isArray(obj.edges) &&
    obj.edges.length > 0 &&
    typeof obj.dimensions?.width === 'number' &&
    typeof obj.dimensions?.height === 'number' &&
    typeof obj.scale === 'number'
  );
}

function parseBlueprintString(svgString: string): BlueprintDataObject | null {
  try {
    // Handle empty or null strings
    if (!svgString || svgString.trim() === '') {
      return null;
    }

    // Security: Sanitize SVG input to prevent XSS
    const sanitizedSvg = extractAndSanitizeSVG(svgString);
    if (!sanitizedSvg) {
      console.warn('[Security] Blueprint SVG failed sanitization');
      logSecurityEvent('SVG_SANITIZATION_FAILED', 'blueprint-visualization', {
        reason: 'sanitization_failed',
        inputLength: svgString.length,
      });
      return null;
    }

    // Check if sanitization removed dangerous content
    if (!isSVGSafe(svgString)) {
      logSecurityEvent('SVG_DANGEROUS_CONTENT_DETECTED', 'blueprint-visualization', {
        action: 'sanitized',
        inputLength: svgString.length,
      });
    }

    // Try to parse as JSON first (in case mobile sends JSON string)
    try {
      const parsed = JSON.parse(svgString);
      if (isBlueprintObject(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON, continue to SVG parsing
    }

    // Parse SVG path data to extract edges
    const pathMatch = svgString.match(/d="([^"]+)"/);
    if (!pathMatch) {
      console.warn('No path data found in SVG string');
      return null;
    }

    const pathData = pathMatch[1];
    const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    
    const edges: Array<{ x: number; y: number }> = [];
    let currentX = 0;
    let currentY = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const cmd of commands) {
      const type = cmd[0].toUpperCase();
      const coords = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
      
      switch (type) {
        case 'M':
        case 'L':
          if (coords.length >= 2) {
            currentX = coords[0];
            currentY = coords[1];
            edges.push({ x: currentX, y: currentY });
            minX = Math.min(minX, currentX);
            minY = Math.min(minY, currentY);
            maxX = Math.max(maxX, currentX);
            maxY = Math.max(maxY, currentY);
          }
          break;
        case 'H':
          if (coords.length >= 1) {
            currentX = coords[0];
            edges.push({ x: currentX, y: currentY });
            minX = Math.min(minX, currentX);
            maxX = Math.max(maxX, currentX);
          }
          break;
        case 'V':
          if (coords.length >= 1) {
            currentY = coords[0];
            edges.push({ x: currentX, y: currentY });
            minY = Math.min(minY, currentY);
            maxY = Math.max(maxY, currentY);
          }
          break;
      }
    }

    if (edges.length < 2) {
      console.warn('Insufficient edges extracted from SVG path');
      return null;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const scale = Math.max(width, height) > 0 ? 1 : 1;

    return {
      edges,
      dimensions: { width, height },
      scale,
    };
  } catch (error) {
    console.error('Error parsing blueprint string:', error);
    return null;
  }
}

function normalizeBlueprintData(data: BlueprintData): BlueprintDataObject | null {
  if (!data) return null;
  
  if (typeof data === 'string') {
    return parseBlueprintString(data);
  }
  
  if (isBlueprintObject(data)) {
    return data;
  }
  
  return null;
}

export default function BlueprintVisualization({
  blueprintData,
  jobStatus,
  width = 600,
  height = 400,
}: BlueprintVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const parsedData = useMemo(() => {
    return normalizeBlueprintData(blueprintData);
  }, [blueprintData]);

  const validation = useMemo(() => {
    if (!parsedData) {
      return { isValid: false, reason: 'no-data' };
    }

    if (!parsedData.edges || parsedData.edges.length < 2) {
      return { isValid: false, reason: 'insufficient-edges' };
    }

    if (!parsedData.dimensions || 
        typeof parsedData.dimensions.width !== 'number' ||
        typeof parsedData.dimensions.height !== 'number') {
      return { isValid: false, reason: 'invalid-dimensions' };
    }

    if (typeof parsedData.scale !== 'number' || parsedData.scale <= 0) {
      return { isValid: false, reason: 'invalid-scale' };
    }

    if (parsedData.dimensions.width <= 0 || parsedData.dimensions.height <= 0) {
      return { isValid: false, reason: 'zero-dimensions' };
    }

    return { isValid: true, reason: null };
  }, [parsedData]);

  const getViewBox = () => {
    if (!parsedData || !validation.isValid) return `0 0 ${width} ${height}`;
    
    const { dimensions, scale } = parsedData;
    const scaledWidth = dimensions.width * scale;
    const scaledHeight = dimensions.height * scale;
    
    const padding = Math.min(scaledWidth, scaledHeight) * 0.1;
    
    return `0 0 ${scaledWidth + padding * 2} ${scaledHeight + padding * 2}`;
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => {
      const newZoom = prevZoom * zoomFactor;
      return Math.max(0.5, Math.min(3.0, newZoom));
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPan(prevPan => ({
      x: prevPan.x + deltaX,
      y: prevPan.y + deltaY,
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoom(prevZoom => Math.min(3.0, prevZoom * 1.2));
  };

  const handleZoomOut = () => {
    setZoom(prevZoom => Math.max(0.5, prevZoom * 0.8));
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      
      return () => {
        svg.removeEventListener('wheel', handleWheel);
      };
    }
  }, []);

  // Loading state: job is processing
  if (jobStatus === 'processing') {
    return (
      <div className="bg-[#1a1a1a] border border-[#F5F5F0]/10 p-6 text-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FF5722]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#FF5722] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-[#F5F5F0]/70 font-mono text-sm tracking-wider">PROCESSING BLUEPRINT...</p>
          <p className="text-[#F5F5F0]/50 text-xs mt-2">AI is generating the blueprint from captured video</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!parsedData || !validation.isValid) {
    const messages: Record<string, { title: string; message: string }> = {
      'no-data': {
        title: 'No Blueprint Data',
        message: jobStatus === 'capturing' 
          ? 'Blueprint will be generated after video capture is complete'
          : 'No blueprint data available for this job',
      },
      'insufficient-edges': {
        title: 'Invalid Blueprint',
        message: 'The blueprint data contains insufficient edge points to render',
      },
      'invalid-dimensions': {
        title: 'Invalid Dimensions',
        message: 'The blueprint dimensions are missing or invalid',
      },
      'invalid-scale': {
        title: 'Invalid Scale',
        message: 'The blueprint scale value is invalid',
      },
      'zero-dimensions': {
        title: 'Zero Dimensions',
        message: 'The blueprint has zero or negative dimensions',
      },
    };

    const { title, message } = messages[validation.reason || 'no-data'];

    return (
      <div className="bg-[#1a1a1a] border border-[#F5F5F0]/10 p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F5F5F0]/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#F5F5F0]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <p className="text-[#F5F5F0]/70 font-medium mb-2">{title}</p>
        <p className="text-[#F5F5F0]/50 text-sm">{message}</p>
      </div>
    );
  }

  const { edges, dimensions, scale } = parsedData;
  const scaledWidth = dimensions.width * scale;
  const scaledHeight = dimensions.height * scale;

  // Validate edges array before rendering
  const validEdges = edges.filter((edge): edge is { x: number; y: number } => 
    typeof edge?.x === 'number' && typeof edge?.y === 'number' && 
    !isNaN(edge.x) && !isNaN(edge.y)
  );

  if (validEdges.length < 2) {
    return (
      <div className="bg-[#1a1a1a] border border-[#F5F5F0]/10 p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-[#F5F5F0]/70 font-medium mb-2">Invalid Edge Data</p>
        <p className="text-[#F5F5F0]/50 text-sm">The blueprint contains invalid or corrupted edge coordinates</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 bg-[#1a1a1a] border border-[#F5F5F0]/10 p-3">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center text-[#F5F5F0]/70 hover:text-[#F5F5F0] hover:bg-[#F5F5F0]/10 transition-colors"
            aria-label="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center text-[#F5F5F0]/70 hover:text-[#F5F5F0] hover:bg-[#F5F5F0]/10 transition-colors"
            aria-label="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleReset}
            className="w-8 h-8 flex items-center justify-center text-[#F5F5F0]/70 hover:text-[#F5F5F0] hover:bg-[#F5F5F0]/10 transition-colors"
            aria-label="Reset view"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div
        className="bg-[#121212] border border-[#F5F5F0]/10 p-4"
        style={{ width: '100%', maxWidth: '100%', aspectRatio: '1.5' }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={getViewBox()}
          xmlns="http://www.w3.org/2000/svg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-in-out',
          }}
          className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(245, 245, 240, 0.03)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={scaledWidth + 40} height={scaledHeight + 40} fill="url(#grid)" />

          {/* Countertop outline */}
          <path
            d={validEdges.reduce((acc, point, index) => {
              const x = point.x * scale;
              const y = point.y * scale;
              return index === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
            }, '') + ' Z'}
            fill="rgba(255, 87, 34, 0.1)"
            stroke="#FF5722"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Corner points */}
          {validEdges.map((point, index) => (
            <circle
              key={index}
              cx={point.x * scale}
              cy={point.y * scale}
              r="4"
              fill="#FF5722"
              stroke="#121212"
              strokeWidth="2"
            />
          ))}

          {/* Dimension arrows and labels */}
          {validEdges.length >= 2 && (
            <>
              {/* Width dimension */}
              <line
                x1={validEdges[0].x * scale}
                y1={validEdges[0].y * scale - 20}
                x2={validEdges[1].x * scale}
                y2={validEdges[1].y * scale - 20}
                stroke="#10b981"
                strokeWidth="2"
              />
              <path
                d={`M ${validEdges[0].x * scale} ${validEdges[0].y * scale - 20} L ${validEdges[0].x * scale - 5} ${validEdges[0].y * scale - 25} L ${validEdges[0].x * scale + 5} ${validEdges[0].y * scale - 25} Z`}
                fill="#10b981"
              />
              <path
                d={`M ${validEdges[1].x * scale} ${validEdges[1].y * scale - 20} L ${validEdges[1].x * scale - 5} ${validEdges[1].y * scale - 25} L ${validEdges[1].x * scale + 5} ${validEdges[1].y * scale - 25} Z`}
                fill="#10b981"
              />
              <text
                x={(validEdges[0].x + validEdges[1].x) * scale / 2}
                y={validEdges[0].y * scale - 30}
                textAnchor="middle"
                fill="#10b981"
                fontSize="12"
                fontWeight="bold"
                style={{ fontFamily: 'monospace' }}
              >
                {dimensions.width.toFixed(1)}&quot;
              </text>

              {/* Height dimension */}
              {validEdges.length >= 3 && (
                <>
                  <line
                    x1={validEdges[0].x * scale + 20}
                    y1={validEdges[0].y * scale}
                    x2={validEdges[0].x * scale + 20}
                    y2={validEdges[2].y * scale}
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <path
                    d={`M ${validEdges[0].x * scale + 20} ${validEdges[0].y * scale} L ${validEdges[0].x * scale + 25} ${validEdges[0].y * scale - 5} L ${validEdges[0].x * scale + 25} ${validEdges[0].y * scale + 5} Z`}
                    fill="#10b981"
                  />
                  <path
                    d={`M ${validEdges[0].x * scale + 20} ${validEdges[2].y * scale} L ${validEdges[0].x * scale + 25} ${validEdges[2].y * scale - 5} L ${validEdges[0].x * scale + 25} ${validEdges[2].y * scale + 5} Z`}
                    fill="#10b981"
                  />
                  <text
                    x={validEdges[0].x * scale + 35}
                    y={(validEdges[0].y + validEdges[2].y) * scale / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#10b981"
                    fontSize="12"
                    fontWeight="bold"
                    transform={`rotate(90, ${validEdges[0].x * scale + 35}, ${(validEdges[0].y + validEdges[2].y) * scale / 2})`}
                    style={{ fontFamily: 'monospace' }}
                  >
                    {dimensions.height.toFixed(1)}&quot;
                  </text>
                </>
              )}
            </>
          )}

          {/* Calibration stick reference */}
          <rect
            x={scaledWidth - 100}
            y={scaledHeight - 20}
            width={100}
            height={10}
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <text
            x={scaledWidth - 50}
            y={scaledHeight - 35}
            textAnchor="middle"
            fill="#F5F5F0"
            fontSize="10"
            style={{ fontFamily: 'monospace' }}
          >
            12&quot; Calibration Stick
          </text>
        </svg>
      </div>
    </div>
  );
}
