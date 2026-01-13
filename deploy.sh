#!/bin/bash

# Проверка аргумента
if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh path/to/function"
  echo "Example: ./deploy.sh auth/AuthLogin"
  exit 1
fi

FUNCTION_PATH=$1
# Извлекаем имя папки (например, AuthLogin)
DIR_NAME=$(basename "$FUNCTION_PATH")
# Превращаем в имя лямбды в AWS (добавляем префикс CMS-)
# ВНИМАНИЕ: Скорректируйте префикс под ваши реалии в AWS
LAMBDA_NAME="CMS-$DIR_NAME"

echo "--- Deploying $DIR_NAME to Lambda $LAMBDA_NAME ---"

# Переходим в папку функции
cd "$FUNCTION_PATH" || exit

# Создаем временный архив (исключая лишнее)
zip -r function.zip . -x "*.git*" "deploy.sh"

# Загружаем в AWS
aws lambda update-function-code --function-name "$LAMBDA_NAME" --zip-file fileb://function.zip

# Удаляем временный архив
rm function.zip

echo "--- Done! ---"
