import { z } from 'zod';
import { Role } from '@prisma/client';

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  fullName: z.string().min(2).max(100),
  password: z.string().min(6),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
