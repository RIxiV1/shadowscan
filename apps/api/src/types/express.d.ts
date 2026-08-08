import type { Role } from '@shadowscan/shared';

// Augments Express's `Request` with the authenticated principal.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
