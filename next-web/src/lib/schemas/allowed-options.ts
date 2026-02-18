import { z } from "zod";

export const allowedOptionsSchema = z.array(z.string().uuid()).nullable();

export type AllowedOptions = z.infer<typeof allowedOptionsSchema>;
