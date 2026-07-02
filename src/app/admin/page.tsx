export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import AdminClient from './AdminClient'

export default function AdminPage() {
  return (
    <Suspense>
      <AdminClient />
    </Suspense>
  )
}
