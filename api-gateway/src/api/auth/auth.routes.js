import { Router } from 'express';
import { body } from 'express-validator';
import { 
  register, 
  login, 
  getMe, 
  updateUserProfile,
  logout,
  linkTelegramHandler
} from './auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import { changePassword } from './auth.controller.js';

const router = Router();

const isEmailOrPhone = (value) => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhone = /^(?:\+7|7|8)\d{10}$/.test(value.replace(/[\s-()]/g, ''));
  
  if (!isEmail && !isPhone) {
    throw new Error('Пожалуйста, введите корректный email или номер телефона.');
  }
  return true;
};

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Аутентификация и управление профилем пользователя
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email или номер телефона пользователя
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               name:
 *                 type: string
 *                 example: "Морфей"
 *               birthDate:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-15"
 *     responses:
 *       201:
 *         description: Пользователь успешно зарегистрирован. Возвращает данные пользователя и токен.
 *       400:
 *         description: Ошибка валидации данных.
 *       409:
 *         description: Пользователь с таким email или телефоном уже существует.
 */
router.post(
  '/register',
  body('email').custom(value => {
    if (!isEmailOrPhone(value)) {
      throw new Error('Пожалуйста, введите корректный email или номер телефона.');
    }
    return true;
  }),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен содержать минимум 6 символов.'),
  body('birthDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Некорректный формат даты (YYYY-MM-DD)')
    .custom((value) => {
      const today = new Date();
      const birth = new Date(value);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      const dayDiff = today.getDate() - birth.getDate();

      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }

      if (age < 5) {
        throw new Error('Возраст должен быть не менее 5 лет');
      }
      if (age > 99) {
        throw new Error('Возраст не может превышать 99 лет');
      }

      return true;
    }),
  register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход пользователя в систему
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email или номер телефона пользователя
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Успешный вход, возвращается JWT токен.
 *       401:
 *         description: Неверные учетные данные.
 */
router.post(
  '/login',
  body('email').custom(value => {
    if (!isEmailOrPhone(value)) {
      throw new Error('Пожалуйста, введите корректный email или номер телефона.');
    }
    return true;
  }),
  body('password').notEmpty().withMessage('Пароль не может быть пустым.'),
  login
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получение данных текущего авторизованного пользователя
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Данные профиля пользователя.
 *       401:
 *         description: Не авторизован (токен отсутствует или недействителен).
 *       404:
 *         description: Пользователь не найден.
 *   put:
 *     summary: Обновление данных профиля текущего пользователя
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Новое Имя"
 *               birthDate:
 *                 type: string
 *                 format: date
 *                 example: "1995-12-10"
 *     responses:
 *       200:
 *         description: Профиль успешно обновлен. Возвращает обновленные данные пользователя.
 *       400:
 *         description: Ошибка валидации или не передано полей для обновления.
 *       401:
 *         description: Не авторизован.
 */
router.route('/me')
  .get(protect, getMe)
  .put(
    protect, 
    body('name').optional().notEmpty().withMessage('Имя не может быть пустым.'),
    body('birthDate').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Некорректный формат даты (YYYY-MM-DD).'),
    updateUserProfile 
  );

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Смена пароля текущего пользователя
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Текущий пароль пользователя
 *                 example: "oldPassword123"
 *               newPassword:
 *                 type: string
 *                 description: Новый пароль (минимум 6 символов)
 *                 minLength: 6
 *                 example: "newStrongPassword456"
 *     responses:
 *       200:
 *         description: Пароль успешно изменен.
 *       400:
 *         description: Ошибка валидации или текущий пароль неверен.
 *       401:
 *         description: Не авторизован (токен отсутствует или недействителен).
 *       404:
 *         description: Пользователь не найден.
 */
router.post(
  '/change-password',
  protect,
  body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль должен содержать минимум 6 символов.'),
  changePassword
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Выход пользователя из системы
 *     description: Добавляет текущий JWT токен в черный список до истечения его срока.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Успешный выход.
 *       401:
 *         description: Не авторизован.
 */
router.post('/logout', protect, logout);

router.post('/link-telegram', protect, linkTelegramHandler);

export default router;