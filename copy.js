// Импортируем необходимые модули для работы с файловой системой и путями
const fs = require('fs').promises; // Используем промисы для асинхронной работы
const path = require('path');

// --- НАСТРОЙКИ ---
// Путь к исходной папке, которую нужно сканировать
const sourceDir = 'C:\\sonnik';

// Путь к папке, куда будут скопированы все файлы
const destDir = 'C:\\sonnik_collected_files';

// Расширения файлов, которые нужно скопировать
const targetExtensions = ['.py', '.js', '.html', '.css', '.jsx'];

// Названия папок, которые нужно игнорировать
const excludedDirs = ['venv', 'node_modules'];
// --- КОНЕЦ НАСТРОЕК ---


/**
 * Рекурсивно обходит директории и копирует нужные файлы.
 * @param {string} currentPath - Текущий путь для сканирования.
 */
async function processDirectory(currentPath) {
  try {
    // Получаем список всех файлов и папок в текущей директории
    const items = await fs.readdir(currentPath, { withFileTypes: true });

    // Проходим по каждому элементу
    for (const item of items) {
      const fullPath = path.join(currentPath, item.name);

      // Если это директория...
      if (item.isDirectory()) {
        // ...и её имя не в списке исключений...
        if (!excludedDirs.includes(item.name)) {
          // ...то запускаем рекурсивный обход для этой подпапки
          await processDirectory(fullPath);
        } else {
          console.log(`-> Игнорирую папку: ${fullPath}`);
        }
      }
      // Если это файл...
      else if (item.isFile()) {
        const extension = path.extname(item.name).toLowerCase();
        // ...и его расширение есть в нашем списке...
        if (targetExtensions.includes(extension)) {
          // Формируем новое имя файла (например, main.py -> main.py.txt)
          const newFileName = `${item.name}.txt`;
          const destPath = path.join(destDir, newFileName);

          // Копируем файл
          await fs.copyFile(fullPath, destPath);
          console.log(`✓ Скопирован: ${fullPath} -> ${destPath}`);
        }
      }
    }
  } catch (error) {
    console.error(`Ошибка при обработке директории ${currentPath}:`, error);
  }
}

/**
 * Главная функция для запуска скрипта.
 */
async function main() {
  console.log('--- Начало работы скрипта ---');
  
  try {
    // Проверяем, существует ли исходная директория
    await fs.access(sourceDir);
  } catch (error) {
    console.error(`Ошибка: Исходная папка не найдена по пути: ${sourceDir}`);
    return; // Прекращаем выполнение
  }

  try {
    // Создаем папку назначения, если её нет.
    // { recursive: true } позволяет создавать вложенные папки и не выдает ошибку, если папка уже существует.
    await fs.mkdir(destDir, { recursive: true });
    console.log(`Папка назначения "${destDir}" готова.`);
    
    // Запускаем основной процесс
    await processDirectory(sourceDir);

  } catch (error) {
    console.error('Произошла критическая ошибка:', error);
  }

  console.log('--- Работа скрипта завершена ---');
}

// Запускаем главную функцию
main();