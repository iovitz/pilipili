import type { Context } from 'node:vm'
import type { Repository } from 'typeorm'
import { Inject, Provide } from '@midwayjs/core'
import { InjectEntityModel } from '@midwayjs/typeorm'
import * as moment from 'moment'
import * as svgCaptcha from 'svg-captcha'
import { VerifyCode } from '../models/verify-code.entity'

@Provide()
export class VerifyService {
  @Inject()
  private ctx: Context

  @InjectEntityModel(VerifyCode)
  private verifyCode: Repository<VerifyCode>

  async getVerifyCode(
    type: string,
    width: number,
    height: number,
    length = 4,
  ) {
    const code = svgCaptcha.create({
      size: length, // 验证码长度
      ignoreChars: 'o01ijlaqf', // 忽略字符
      color: false, // 是否采用彩色字符串
      noise: Math.floor(Math.random() * 3), // 干扰线条
      width, // 图片宽
      height, // 图片长
      background: '#ffffff',
    })
    const verifyCode = new VerifyCode()
    verifyCode.code = code.text
    verifyCode.type = type
    this.ctx.logger.info('generate verify code:', verifyCode.code)

    await this.verifyCode.save(verifyCode)
    return {
      id: verifyCode.id,
      svg: code.data,
    }
  }

  async checkVerifyCode(
    type: string,
    id: string,
    code: string,
  ) {
    // 从DB中获取验证码
    const codeModel = await this.verifyCode.findOne({
      where: {
        id,
        type,
        status: false,
      },
    })

    if (!codeModel || code.toLowerCase() !== codeModel.code.toLowerCase()) {
      this.ctx.logger.warn('验证码校验失败', {
        input: code.toLowerCase(),
        right: codeModel?.code.toLowerCase(),
      })
      return false
    }

    // 判断验证码是不是30Min内下发的
    if (moment(codeModel.createdAt).add(30, 'M') < moment(Date.now())) {
      this.ctx.logger.warn('验证码过期', codeModel.createdAt)
      return false
    }

    if (code.toLowerCase() !== codeModel.code.toLowerCase()) {
      this.ctx.logger.warn('验证码校验失败', {
        input: code.toLowerCase(),
        right: codeModel.code.toLowerCase(),
      })
      return false
    }

    codeModel.status = true
    await this.verifyCode.save(codeModel)
    return true
  }
}
