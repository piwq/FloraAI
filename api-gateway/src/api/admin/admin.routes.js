import { Router } from 'express';
import { body } from 'express-validator';
import { protect, admin } from '../../middlewares/auth.middleware.js';
import { getAllUsers, addInterpretations, setUserStatus, getUserSessions } from './admin.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Управление пользователями (только для администраторов)
 */

router.use(protect, admin);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Получить список всех пользователей с пагинацией и поиском
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Количество пользователей на странице.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поисковый запрос по email или имени пользователя.
 *     responses:
 *       200:
 *         description: Список пользователей и информация о пагинации.
 *       403:
 *         description: Доступ запрещен (недостаточно прав).
 */
router.get('/users', getAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}/add-interpretations:
 *   post:
 *     summary: Добавить указанное количество попыток толкования пользователю
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID пользователя, которому добавляются попытки.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: Количество добавляемых попыток.
 *                 example: 50
 *     responses:
 *       200:
 *         description: Успешно. Возвращает обновленные данные пользователя.
 *       400:
 *         description: Некорректное значение 'amount'.
 *       403:
 *         description: Доступ запрещен.
 *       404:
 *         description: Пользователь с указанным ID не найден.
 */
router.post(
    '/users/:id/add-interpretations',
    body('amount').isInt({ gt: 0 }).withMessage('amount должен быть целым числом больше нуля.'),
    addInterpretations
);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     summary: Установить статус пользователя (забанить/разбанить)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, BANNED]
 *     responses:
 *       200:
 *         description: Статус успешно обновлен.
 *       400:
 *         description: Некорректный статус.
 */
router.put('/users/:id/status', setUserStatus);

/**
 * @swagger
 * /api/admin/users/{id}/sessions:
 *   get:
 *     summary: Получить историю снов конкретного пользователя
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 15 }
 *     responses:
 *       200:
 *         description: Список сессий пользователя.
 */
router.get('/users/:id/sessions', getUserSessions);

export default router;