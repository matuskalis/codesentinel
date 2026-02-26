import { beforeAll, afterAll } from 'vitest'

beforeAll(() => {
  process.env = { ...process.env, NODE_ENV: 'test' }
})

afterAll(() => {
  // Cleanup
})
