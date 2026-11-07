// الإعدادات: بنقرأ Backend/.env (إذا موجود) وبعدين .env الرئيسي تبع المشروع
// (dotenv ما بيكتب فوق قيمة موجودة، فالأول بيربح)
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });
dotenv.config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });

// إذا ما في DATABASE_URL، بنتصل بداتابيس docker compose على هاد الجهاز
// ("docker compose up -d db") : الباسورد اختياري، والافتراضي "rank" زي docker-compose.yml
if (!process.env.DATABASE_URL) {
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || "rank");
  const port = process.env.DB_PORT || 5432;
  process.env.DATABASE_URL = `postgres://rank:${password}@localhost:${port}/rank`;
}
