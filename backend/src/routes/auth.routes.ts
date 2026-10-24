import { Router } from 'express';
import { handleGoogleLogin, handleDemoLogin, handleGetMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/google', handleGoogleLogin);
authRouter.post('/demo', handleDemoLogin);
authRouter.get('/me', requireAuth, handleGetMe);

export default authRouter;
