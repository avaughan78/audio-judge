export default function BrandName({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ''}`}>
      <img src="/logo-mark.svg" alt="" width={size} height={size} style={{ display: 'block' }} />
      <span style={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
        <span style={{ color: 'var(--text-primary)' }}>Audio</span>{' '}
        <span style={{ color: '#65A30D' }}>Judge</span>
      </span>
    </span>
  )
}
