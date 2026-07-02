export default function BrandName({ className }: { className?: string }) {
  return (
    <span className={className} style={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
      <span style={{ color: 'var(--text-primary)' }}>Audio</span>{' '}
      <span style={{ color: '#65A30D' }}>Judge</span>
    </span>
  )
}
