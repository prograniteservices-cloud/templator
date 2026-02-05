/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Badge } from '@/components/ui/Badge'

describe('Badge Component', () => {
  it('renders with default (complete) variant', () => {
    render(<Badge>Complete</Badge>)
    const badge = screen.getByText('Complete')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('border-emerald-500/30')
    expect(badge).toHaveClass('bg-emerald-500/10')
    expect(badge).toHaveClass('text-emerald-400')
  })

  it('renders with capturing variant', () => {
    render(<Badge variant="capturing">Capturing</Badge>)
    const badge = screen.getByText('Capturing')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('border-blue-500/30')
    expect(badge).toHaveClass('bg-blue-500/10')
    expect(badge).toHaveClass('text-blue-400')
  })

  it('renders with processing variant', () => {
    render(<Badge variant="processing">Processing</Badge>)
    const badge = screen.getByText('Processing')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('border-amber-500/30')
    expect(badge).toHaveClass('bg-amber-500/10')
    expect(badge).toHaveClass('text-amber-400')
  })

  it('renders with failed variant', () => {
    render(<Badge variant="failed">Failed</Badge>)
    const badge = screen.getByText('Failed')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('border-red-500/30')
    expect(badge).toHaveClass('bg-red-500/10')
    expect(badge).toHaveClass('text-red-400')
  })

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    expect(screen.getByText('Custom')).toHaveClass('custom-class')
  })

  it('renders with uppercase and tracking styles', () => {
    render(<Badge>Test Badge</Badge>)
    const badge = screen.getByText('Test Badge')
    expect(badge).toHaveClass('uppercase')
    expect(badge).toHaveClass('tracking-wider')
  })

  it('passes through additional props', () => {
    render(<Badge data-testid="test-badge">Test</Badge>)
    expect(screen.getByTestId('test-badge')).toBeInTheDocument()
  })
})
