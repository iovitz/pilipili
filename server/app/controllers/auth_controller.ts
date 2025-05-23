import type { HttpContext } from '@adonisjs/core/http'
import Auth from '#models/auth'
import { AuthService } from '#services/auth_service'
import { EncryptService } from '#services/encrypt_service'
import { SecurityService } from '#services/security_service'
import { loginValidator, registerValidator } from '#validators/auth'
import { inject } from '@adonisjs/core'
import createHttpError from 'http-errors'

@inject()
export default class AuthController {
  constructor(
    private encryptService: EncryptService,
    private authService: AuthService,
    private securityService: SecurityService,
  ) {}

  async register({ request, logger, response }: HttpContext) {
    const body = await registerValidator.validate(request.body())
    const { identifier, credential: bodyCredential, identityType, nickname } = body

    // 验证码校验
    if (!await this.securityService.checkVerifyCode('register', body.verifyCodeId, body.verifyCode)) {
      throw createHttpError(400, 'Verification code verification failed')
    }

    // 查询是否已经注册
    const identifierItem = await Auth.findBy({
      identifier,
      identityType,
    })
    if (identifierItem) {
      return response.conflict({
        message: 'identifier already exist',
      })
    }

    let credential: string
    switch (identityType) {
      case 'email':
        logger.info('register with email')
        // TODO 校验邮箱
        // TODO 发送验证码
        credential = await this.encryptService.argon2Hash(bodyCredential)
        break
      default:
        throw createHttpError(422, 'identityType not support')
    }

    const [newUserRecord] = await this.authService.createUser(
      identifier,
      credential!,
      identityType,
      nickname,
    )
    return {
      userId: newUserRecord.id,
    }
  }

  async login({ request, response, logger }: HttpContext) {
    const body = await loginValidator.validate(request.body())
    const { identifier, credential, identityType } = body

    // 验证码校验
    if (!await this.securityService.checkVerifyCode('register', body.verifyCodeId, body.verifyCode)) {
      throw createHttpError(400, 'Verification code verification failed')
    }

    const identifierItem = await Auth.findBy({
      identifier,
      identityType,
    })
    if (!identifierItem) {
      throw createHttpError(401, 'identifier match fail')
    }
    switch (identityType) {
      case 'email':
        if (!(await this.encryptService.argon2Verify(identifierItem.credential, credential))) {
          throw createHttpError(401, 'identifier match fail')
        }
        break
      default:
        throw createHttpError(422, 'identityType not support')
    }
    // 创建session
    const sessionId = await this.authService.createSession(
      identifierItem.userId,
      request.header('user-agent') ?? '',
    )
    logger.info(`Login Success: ${identifierItem.userId} ${sessionId}`)
    response.cookie('ss', sessionId, {
      domain: '',
      path: '/',
      maxAge: '30d',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
    return true
  }

  async logout(ctx: HttpContext) {
    const sessionId = ctx.request.cookie('ss')
    if (sessionId) {
      await this.authService.deleteSession(sessionId)
    }
    ctx.response.clearCookie('ss')
    return true
  }
}
