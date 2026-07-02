import Link from 'next/link'

export default function BrandName({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <Link href="/admin" className={`flex items-center gap-2 ${className ?? ''}`} style={{ textDecoration: 'none' }}>
      <img src="/logo-mark.svg" alt="" width={size} height={size} style={{ display: 'block' }} />
      <span style={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
        <span style={{ color: 'var(--text-primary)' }}>Audio</span>{' '}
        <span style={{ color: '#65A30D' }}>Judge</span>
      </span>
    </Link>
  )
}
