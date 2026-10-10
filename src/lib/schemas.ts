/**
 * Zod validation schemas for all API endpoints.
 */
import { z } from 'zod';

// ─── Auth ───────────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

// ─── Trade ──────────────────────────────────────────────────────────
export const tradeSchema = z.object({
  companyId: z.string().min(1),
  qty: z.number().int().positive(),
  action: z.enum(['buy', 'sell']),
});

// ─── Choice ─────────────────────────────────────────────────────────
export const choiceSchema = z.object({
  eventId: z.string().min(1),
  option: z.enum(['AGGRESSIVE', 'MODERATE', 'PASS', 'HOLD', 'SELL_HALF', 'EXIT']),
});

// ─── Team Notes ─────────────────────────────────────────────────────
export const teamNotesSchema = z.object({
  line1: z.string().max(500).default(''),
  line2: z.string().max(500).default(''),
  line3: z.string().max(500).default(''),
});

// ─── Admin: Team CRUD ───────────────────────────────────────────────
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(4).max(200),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(4).max(200),
});

// ─── Admin: Company CRUD ────────────────────────────────────────────
export const createCompanySchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/),
  sector: z.string().min(1).max(100),
  basePrice: z.string().default('1000'),
  poolSize: z.number().int().positive().default(2000),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/).optional(),
  sector: z.string().min(1).max(100).optional(),
});

// ─── Admin: Event editing ───────────────────────────────────────────
export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  questionText: z.string().min(1).max(1000).optional(),
  companies: z.array(z.object({
    companyId: z.string().min(1),
    aggressiveMove: z.string().optional(),
    moderateMove: z.string().optional(),
    holdDrop: z.string().optional(),
  })).optional(),
});

// ─── Admin: Market toggle ───────────────────────────────────────────
export const marketToggleSchema = z.object({
  open: z.boolean(),
});

// ─── Admin: Phase advance ───────────────────────────────────────────
export const phaseAdvanceSchema = z.object({
  force: z.boolean().default(false),
  targetPhase: z.string().optional(),
});

// ─── Admin: Judge scores ────────────────────────────────────────────
export const judgeScoreSchema = z.object({
  teamId: z.string().min(1),
  judgeName: z.string().min(1).max(100),
  clarity: z.number().int().min(0).max(1),
  justification: z.number().int().min(0).max(1),
  answerQuality: z.number().int().min(0).max(1),
});

// ─── Admin: Reset ───────────────────────────────────────────────────
export const resetSchema = z.object({
  confirmation: z.literal('RESET ROUND'),
});
