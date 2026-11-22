import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError, UnauthorizedError, ConflictError } from '../../utils/appError';
import { RegisterInput, LoginInput } from './auth.schema';
import { Role } from '@prisma/client';

export class AuthService {
  static async register(input: RegisterInput, currentUserId?: string) {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (existing) {
      throw new ConflictError('Username already taken');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        passwordHash,
        role: input.role,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  static async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid username or account is deactivated');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return user;
  }
}
