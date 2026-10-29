import { z } from 'zod';

// Normalize before validation and before any database lookup or write.
export const emailInput = z.string().trim().toLowerCase().email();
