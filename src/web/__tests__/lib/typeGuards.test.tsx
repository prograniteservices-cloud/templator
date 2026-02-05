/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import BlueprintVisualization from '@/components/BlueprintVisualization'
import type { BlueprintData, BlueprintDataObject } from '@/types/job'

describe('Type Guards - BlueprintData Validation', () => {
  describe('Valid BlueprintDataObject', () => {
    it('should accept valid blueprint object with all required fields', () => {
      const validData: BlueprintDataObject = {
        edges: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
          { x: 0, y: 50 },
        ],
        dimensions: { width: 100, height: 50 },
        scale: 1,
      }

      const { container } = render(
        <BlueprintVisualization blueprintData={validData} jobStatus="complete" />
      )
      
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should accept blueprint with large coordinate values', () => {
      const largeData: BlueprintDataObject = {
        edges: [
          { x: 0, y: 0 },
          { x: 999999, y: 0 },
          { x: 999999, y: 999999 },
          { x: 0, y: 999999 },
        ],
        dimensions: { width: 999999, height: 999999 },
        scale: 1,
      }

      const { container } = render(
        <BlueprintVisualization blueprintData={largeData} jobStatus="complete" />
      )
      
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should accept blueprint with floating point coordinates', () => {
      const floatData: BlueprintDataObject = {
        edges: [
          { x: 0.5, y: 0.25 },
          { x: 100.75, y: 0.25 },
          { x: 100.75, y: 50.5 },
          { x: 0.5, y: 50.5 },
        ],
        dimensions: { width: 100.25, height: 50.25 },
        scale: 1.5,
      }

      const { container } = render(
        <BlueprintVisualization blueprintData={floatData} jobStatus="complete" />
      )
      
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Invalid Data States', () => {
    it('should show no data message for null', () => {
      render(<BlueprintVisualization blueprintData={null} jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })

    it('should show no data message for undefined', () => {
      render(<BlueprintVisualization blueprintData={undefined as any} jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })

    it('should show no data message for empty string', () => {
      render(<BlueprintVisualization blueprintData="" jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })

    it('should show no data message for empty object', () => {
      render(<BlueprintVisualization blueprintData={{}} jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })

    it('should show invalid blueprint error for single edge', () => {
      const singleEdgeData = {
        edges: [{ x: 0, y: 0 }],
        dimensions: { width: 0, height: 0 },
        scale: 1,
      }

      render(<BlueprintVisualization blueprintData={singleEdgeData} jobStatus="complete" />)
      expect(screen.getByText('Invalid Blueprint')).toBeInTheDocument()
    })

    it('should show zero dimensions error for blueprint with zero dimensions', () => {
      const zeroDimData = {
        edges: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
          { x: 0, y: 50 },
        ],
        dimensions: { width: 0, height: 0 },
        scale: 1,
      }

      render(<BlueprintVisualization blueprintData={zeroDimData} jobStatus="complete" />)
      expect(screen.getByText('Zero Dimensions')).toBeInTheDocument()
    })

    it('should show invalid scale error for negative scale', () => {
      const invalidData = {
        edges: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: -1,
      }

      render(<BlueprintVisualization blueprintData={invalidData} jobStatus="complete" />)
      expect(screen.getByText('Invalid Scale')).toBeInTheDocument()
    })

    it('should show invalid scale error for zero scale', () => {
      const invalidData = {
        edges: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: 0,
      }

      render(<BlueprintVisualization blueprintData={invalidData} jobStatus="complete" />)
      expect(screen.getByText('Invalid Scale')).toBeInTheDocument()
    })

    it('should show invalid edge data error for NaN coordinates', () => {
      const invalidData = {
        edges: [{ x: NaN, y: 0 }, { x: 100, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: 1,
      }

      render(<BlueprintVisualization blueprintData={invalidData} jobStatus="complete" />)
      expect(screen.getByText('Invalid Edge Data')).toBeInTheDocument()
    })
  })

  describe('SVG String Parsing', () => {
    it('should parse valid SVG path string', () => {
      const svgString = '<svg><path d="M 0 0 L 100 0 L 100 50 L 0 50 Z" /></svg>'
      const { container } = render(
        <BlueprintVisualization blueprintData={svgString} jobStatus="complete" />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should show no data message for SVG without path', () => {
      const invalidSvg = '<svg><circle cx="50" cy="50" r="40" /></svg>'
      render(<BlueprintVisualization blueprintData={invalidSvg} jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })

    it('should show no data message for malformed SVG', () => {
      render(<BlueprintVisualization blueprintData="not-valid-svg" jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })

    it('should show no data message for SVG with single point', () => {
      // SVG with single point produces null when parsed (insufficient edges)
      const svgString = '<svg><path d="M 50 50" /></svg>'
      render(<BlueprintVisualization blueprintData={svgString} jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })
  })

  describe('JSON String Parsing', () => {
    it('should parse JSON string representing valid blueprint', () => {
      const jsonString = JSON.stringify({
        edges: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: 1,
      })
      
      const { container } = render(
        <BlueprintVisualization blueprintData={jsonString} jobStatus="complete" />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should show no data for invalid JSON', () => {
      render(<BlueprintVisualization blueprintData="{ invalid json" jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })

    it('should show no data for JSON with invalid structure', () => {
      const invalidJson = JSON.stringify({
        edges: 'not-an-array',
        dimensions: { width: 100, height: 50 },
        scale: 1,
      })
      render(<BlueprintVisualization blueprintData={invalidJson} jobStatus="complete" />)
      expect(screen.getByText('No Blueprint Data')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle blueprint with very small scale', () => {
      const validData = {
        edges: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: 0.0001,
      }
      const { container } = render(
        <BlueprintVisualization blueprintData={validData} jobStatus="complete" />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should handle blueprint with very large scale', () => {
      const validData = {
        edges: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: 1000000,
      }
      const { container } = render(
        <BlueprintVisualization blueprintData={validData} jobStatus="complete" />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should handle blueprint with Infinity coordinates gracefully', () => {
      const dataWithInfinity = {
        edges: [{ x: Infinity, y: 0 }, { x: 100, y: 100 }],
        dimensions: { width: 100, height: 100 },
        scale: 1,
      }
      // Infinity passes isBlueprintObject (it's a valid number type)
      // Component renders with Infinity values in SVG
      const { container } = render(
        <BlueprintVisualization blueprintData={dataWithInfinity} jobStatus="complete" />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })
})
