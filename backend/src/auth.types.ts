// server/src/auth.types.ts

export type AuthRole = "ADMIN" | "STAFF";

export type AuthContext = {
  userId: string;
  email: string;
  role: AuthRole;
};

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}

export {};
