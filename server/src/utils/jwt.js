import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAuthToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function signScopedToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, env.jwtSecret, { expiresIn });
}

export function verifyScopedToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
