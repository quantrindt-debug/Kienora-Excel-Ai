import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(express.json({ limit: '20mb' }));
app.use(express.static('.'));

const SYSTEM = `Bạn là Kienora Excel AI, trợ lý làm việc với bảng tính tiếng Việt.\n`+
`Nhiệm vụ: đọc dữ liệu dạng hàng/cột và hiểu lệnh của người dùng.\n`+
`Không được tự ý sửa dữ liệu. Chỉ tạo danh sách thay đổi đề xuất.\n`+
`Mỗi thay đổi phải chỉ rõ row (1-based theo bảng dữ liệu, không tính header), column là tên cột chính xác, oldValue và newValue.\n`+
`Nếu yêu cầu chỉ hỏi/thống kê thì changes phải là mảng rỗng.\n`+
`Nếu dữ liệu không đủ, nêu rõ trong answer và không bịa.\n`+
`Trả JSON hợp lệ theo schema.`;

app.post('/api/ai', async (req, res) => {
  try {
    const { command, headers, rows } = req.body || {};
    if (!command || !Array.isArray(headers) || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Thiếu command, headers hoặc rows.' });
    }
    if (!client) {
      return res.status(500).json({ error: 'Chưa cấu hình OPENAI_API_KEY trong file .env.' });
    }

    const payload = {
      command,
      headers,
      rows
    };

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: SYSTEM,
      input: JSON.stringify(payload),
      text: {
        format: {
          type: 'json_schema',
          name: 'excel_action',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              answer: { type: 'string' },
              changes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    row: { type: 'integer', minimum: 1 },
                    column: { type: 'string' },
                    oldValue: { type: 'string' },
                    newValue: { type: 'string' },
                    reason: { type: 'string' }
                  },
                  required: ['row','column','oldValue','newValue','reason']
                }
              }
            },
            required: ['answer','changes']
          }
        }
      }
    });

    const text = response.output_text || '{}';
    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Lỗi máy chủ AI.' });
  }
});

app.listen(port, () => console.log(`Kienora Excel AI V1: http://localhost:${port}`));
