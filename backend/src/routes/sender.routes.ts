import { Router } from 'express';
import { handleGetSenders, handleCreateSender } from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const senderRouter = Router();

senderRouter.use(requireAuth);

senderRouter.get('/', handleGetSenders);
senderRouter.post('/', handleCreateSender);

export default senderRouter;
