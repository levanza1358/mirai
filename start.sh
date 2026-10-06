docker stop mirai
docker rm mirai
docker build -t mirai .
docker run -d --name mirai -p 1463:1463 --env-file .env -v mirai-data:/app/data mirai