/**
 * Lobby API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    bot: {
      findUnique: mockFindUnique,
    },
    lobby: {
      create: mockCreate,
    },
  },
}))

describe('POST /api/lobby/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a lobby with valid request', async () => {
    const mockBot = { id: 'bot1', name: 'TestBot', apiKey: 'test-key-123' }
    const mockLobby = {
      id: 'lobby1',
      code: 'ABC12',
      agentSlots: 4,
      filledSlots: 1,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }

    mockFindUnique.mockResolvedValue(mockBot)
    mockCreate.mockResolvedValue(mockLobby)

    const { POST } = await import('@/app/api/lobby/create/route')

    const req = new Request('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-key-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_slots: 4, opponents: [] }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.lobby.code).toBe('ABC12')
    expect(json.lobby.slots.total).toBe(4)
    expect(json.lobby.slots.filled).toBe(1)
    expect(json.lobby.slots.remaining).toBe(3)
  })

  it('should reject request without authorization', async () => {
    const { POST } = await import('@/app/api/lobby/create/route')

    const req = new Request('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_slots: 4 }),
    })

    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('should reject invalid API key', async () => {
    mockFindUnique.mockResolvedValue(null)

    const { POST } = await import('@/app/api/lobby/create/route')

    const req = new Request('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_slots: 4 }),
    })

    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('should reject agent_slots less than 2', async () => {
    const mockBot = { id: 'bot1', name: 'TestBot', apiKey: 'test-key-123' }
    mockFindUnique.mockResolvedValue(mockBot)

    const { POST } = await import('@/app/api/lobby/create/route')

    const req = new Request('http://localhost:3000/api/lobby/create', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-key-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_slots: 1 }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('agent_slots must be >= 2')
  })
})
