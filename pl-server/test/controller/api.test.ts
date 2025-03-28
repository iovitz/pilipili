import type { Framework } from '@midwayjs/koa'
import { close, createApp, createHttpRequest } from '@midwayjs/mock'

describe('test/controller/home.test.ts', () => {
  it('should POST /api/get_user', async () => {
    // create app
    const app = await createApp<Framework>()

    // make request
    const result = await createHttpRequest(app).get('/api/get_user').query({ uid: 123 })

    // use expect by jest
    expect(result.status).toBe(200)
    expect(result.body.message).toBe('OK')

    // close app
    await close(app)
  })
})
