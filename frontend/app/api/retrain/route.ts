import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '')

export async function POST() {
  const token = process.env.ADMIN_TOKEN
  if (!token) {
    return NextResponse.json({ detail: 'Admin token not configured on server' }, { status: 500 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/admin/retrain/sync`, {
      method: 'POST',
      headers: { 'X-Admin-Token': token },
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ detail: 'Failed to reach backend' }, { status: 502 })
  }
}
