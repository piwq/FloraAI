import asyncHandler from 'express-async-handler';
import { paymentService } from '../../services/payment.service.js';

export const mockSubscribe = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const updatedUser = await paymentService.upgradeToPremium(userId);
  res.status(200).json({ 
    message: 'Подписка Premium успешно оформлена!', 
    user: updatedUser 
  });
});