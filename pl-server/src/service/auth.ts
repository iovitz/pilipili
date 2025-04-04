import { Application } from '@midwayjs/koa'
import {
  DataSource,
  FindOptionsSelect,
  FindOptionsWhere,
  Repository,
} from 'typeorm'
import { EncryptService } from './encrypt'
import { App, Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core'
import { InjectDataSource, InjectEntityModel } from '@midwayjs/typeorm'
import { customAlphabet } from 'nanoid'
import * as uuid from 'uuid'
import { Session } from '../models/session.entity'
import { User } from '../models/user.entity'

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class AuthService {
  @App()
  app: Application

  @InjectDataSource()
  defaultDataSource: DataSource

  @InjectEntityModel(Session)
  private sessionModel: Repository<Session>

  @InjectEntityModel(User)
  private User: Repository<User>

  @Inject()
  private encrypt: EncryptService

  avatarGenerator = customAlphabet(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    10,
  )

  findUserBy(where: FindOptionsWhere<User>, select: FindOptionsSelect<User>) {
    return this.User.findOne({
      where,
      select,
    })
  }

  async createUser(email: string, password: string) {
    const key = this.app.getConfig('secrets.multiAvatar')
    const user = new User()

    user.nickname = `用户${Math.random()}`
    user.email = email
    user.password = await this.encrypt.bcryptEncode(password)
    user.avatar = `https://api.multiavatar.com/Starcrasher.png?apikey=${key}`

    await this.User.save(user)
    return user
  }

  async createSession(user: User, useragent?: string) {
    const sessionId = uuid.v4()
    const session = this.sessionModel.create({
      sessionId,
      userId: user.id,
      useragent,
    })
    this.sessionModel.save(session)
    return sessionId
  }

  async getSessionInfo(sessionId: string) {
    const session = this.sessionModel.findOneBy({
      sessionId,
    })
    return session
  }
}
