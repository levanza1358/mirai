# Tích hợp OpenAI Codex CLI

Tích hợp Mirai với OpenAI Codex CLI để định tuyến request API OpenAI qua hệ thống routing thông minh của Mirai.

## Yêu cầu

- OpenAI Codex CLI đã cài đặt
- Mirai đang chạy cục bộ hoặc cloud endpoint đã cấu hình
- API key từ Mirai dashboard

## Setup

### 1. Cấu hình biến môi trường

Đặt các biến môi trường sau trong file cấu hình shell (`~/.bashrc`, `~/.zshrc`, hoặc `~/.bash_profile`):

```bash
# Base URL for Mirai
export OPENAI_BASE_URL="http://localhost:1463/v1"

# API Key from Mirai dashboard
export OPENAI_API_KEY="your-mirai-api-key"
```

### 2. Reload Shell Configuration

```bash
source ~/.zshrc  # or ~/.bashrc
```

### 3. Xác minh Cấu hình

Kiểm tra các biến môi trường đã set đúng:

```bash
echo $OPENAI_BASE_URL
echo $OPENAI_API_KEY
```

## Model có sẵn

Mirai cung cấp các model Codex sau:

| Model ID | Mô tả |
|----------|-------------|
| `cx/gpt-5.2-codex` | GPT-5.2 Codex - Phiên bản mới nhất |
| `cx/gpt-5.1-codex-max` | GPT-5.1 Codex Max - Extended context |

## Ví dụ Sử dụng

### Sử dụng Cơ bản

```bash
# Use GPT-5.2 Codex
codex --model cx/gpt-5.2-codex "Write a function to sort an array"

# Use GPT-5.1 Codex Max
codex --model cx/gpt-5.1-codex-max "Explain this complex algorithm"
```

### Tạo Code

```bash
codex --model cx/gpt-5.2-codex "Create a REST API endpoint for user authentication"
```

### Giải thích Code

```bash
codex --model cx/gpt-5.1-codex-max "Explain what this code does: $(cat myfile.js)"
```

## File Cấu hình

Bạn cũng có thể cấu hình Codex CLI qua file cấu hình. Tạo hoặc sửa `~/.codex/config.json`:

```json
{
  "baseUrl": "http://localhost:1463/v1",
  "apiKey": "your-mirai-api-key",
  "defaultModel": "cx/gpt-5.2-codex"
}
```

## Troubleshooting

### Lỗi Xác thực

Nếu gặp lỗi xác thực:

1. Xác minh API key đúng trong Mirai dashboard
2. Kiểm tra biến môi trường `OPENAI_API_KEY` đã set
3. Đảm bảo API key chưa hết hạn

### Lỗi Connection

Nếu gặp lỗi kết nối:

1. Xác minh Mirai đang chạy: `curl http://localhost:1463/health`
2. Kiểm tra biến môi trường đã set đúng
3. Đảm bảo không firewall nào chặn port 1463

### Model không khả dụng

Nếu gặp lỗi "model not available":

1. Xác minh tên model khớp với cấu hình Mirai
2. Kiểm tra kết nối provider OpenAI đang hoạt động trong Mirai dashboard
3. Đảm bảo model có sẵn trong các provider đã kết nối

## Cloud Endpoint

Để dùng Mirai cloud endpoint thay vì localhost:

```bash
export OPENAI_BASE_URL="https://mirai.local"
```

Đảm bảo bạn đã cấu hình API key trong Mirai cloud dashboard.

## Cấu hình Nâng cao

### Custom Timeout

```bash
export OPENAI_TIMEOUT=60  # seconds
```

### Debug Mode

Bật debug mode để xem logs request/response chi tiết:

```bash
export CODEX_DEBUG=true
codex --model cx/gpt-5.2-codex "Your prompt"
```
