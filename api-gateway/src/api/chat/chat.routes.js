import { Router } from 'express';
import { body } from 'express-validator';
import { 
  createChatSession, 
  addMessageToSession,
  getUserChatSessions, 
  getChatSessionById,
  deleteChatSession
} from './chat.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Управление сессиями чата (снами)
 */

router.use(protect);

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Создать новую сессию чата (отправить сон)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Текст сна пользователя
 *                 example: "Мне приснилось, что я летаю над ночным городом."
 *     responses:
 *       201:
 *         description: Сессия успешно создана, возвращается ответ ИИ.
 *       400:
 *         description: Ошибка валидации (например, пустой текст или ошибка от AI-сервиса).
 *       403:
 *         description: Закончились доступные попытки толкования.
 */
router.post(
  '/', 
  body('text').notEmpty().withMessage('Текст сна не может быть пустым.'),
  createChatSession
);

/**
 * @swagger
 * /api/chat/{sessionId}/messages:
 *   post:
 *     summary: Отправить новое сообщение в существующую сессию чата
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID сессии чата, в которую добавляется сообщение.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Текст нового сообщения (уточняющий вопрос).
 *                 example: "А что значит, если кит был фиолетовым?"
 *     responses:
 *       202:
 *         description: Запрос принят в обработку. Ответ придет через WebSocket.
 *       400:
 *         description: Ошибка валидации (пустой текст).
 *       403:
 *         description: Доступ запрещен.
 *       404:
 *         description: Сессия не найдена.
 */
router.post(
  '/:sessionId/messages',
  body('text').notEmpty().withMessage('Текст сообщения не может быть пустым.'),
  addMessageToSession
);


/**
 * @swagger
 * /api/chat:
 *   get:
 *     summary: Получить список сессий пользователя (с пагинацией)
 *     tags: [Chat]
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
 *           default: 15
 *         description: Количество элементов на странице.
 *     responses:
 *       200:
 *         description: Список сессий и информация о пагинации.
 */
router.get('/', getUserChatSessions);

/**
 * @swagger
 * /api/chat/{sessionId}:
 *   get:
 *     summary: Получить полную историю сообщений для одной сессии
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID сессии чата.
 *     responses:
 *       200:
 *         description: Полные данные сессии со всеми сообщениями.
 *       403:
 *         description: Доступ запрещен (сессия принадлежит другому пользователю).
 *       404:
 *         description: Сессия не найдена.
 *   delete:
 *     summary: Удалить сессию чата
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID сессии чата для удаления.
 *     responses:
 *       204:
 *         description: Сессия успешно удалена.
 *       403:
 *         description: Доступ запрещен.
 *       404:
 *         description: Сессия не найдена.
 */
router.route('/:sessionId')
  .get(getChatSessionById)
  .delete(deleteChatSession);


export default router;