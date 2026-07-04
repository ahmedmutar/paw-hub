import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { LoginInput } from './auth.schema'

const REFRESH_TTL_DAYS = 7

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async login(
    input: LoginInput,
    signAccess: (p: object) => string,
    signRefresh: (p: object) => string
  ) {
    const user = await this.prisma.user.findFirst({
      where: { username: input.username, isDeleted: false },
      include: { branch: { select: { branchName: true } } },
    })

    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new Error('Username atau password salah!')
    }
    if (!user.status) {
      throw new Error('Akun tidak aktif. Hubungi administrator.')
    }

    const payload = {
      userId: user.id.toString(),
      username: user.username,
      role: user.role,
      branchId: user.branchId.toString(),
    }

    const accessToken = signAccess(payload)
    const refreshToken = signRefresh(payload)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS)

    // Hapus token lama, simpan yang baru
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } })
    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt },
    })

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.id.toString(),
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        imageProfile: user.imageProfile,
        branchId: user.branchId.toString(),
        branchName: user.branch.branchName,
      },
    }
  }

  async refresh(token: string, signAccess: (p: object) => string, verifyRefresh: (t: string) => any) {
    let payload: any
    try {
      payload = verifyRefresh(token)
    } catch {
      throw new Error('Refresh token tidak valid!')
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { token, userId: BigInt(payload.userId) },
    })
    if (!stored || stored.expiresAt < new Date()) {
      throw new Error('Refresh token kadaluarsa. Silakan login ulang.')
    }

    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(payload.userId), isDeleted: false, status: true },
    })
    if (!user) throw new Error('Akun tidak ditemukan atau tidak aktif.')

    const newPayload = {
      userId: user.id.toString(),
      username: user.username,
      role: user.role,
      branchId: user.branchId.toString(),
    }

    return { accessToken: signAccess(newPayload) }
  }

  async logout(userId: bigint) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } })
  }

  async changePassword(userId: bigint, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('User tidak ditemukan.')
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      throw new Error('Password lama tidak sesuai.')
    }
    const hashed = await bcrypt.hash(newPassword, 12)
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } })
    await this.prisma.refreshToken.deleteMany({ where: { userId } })
  }
}
