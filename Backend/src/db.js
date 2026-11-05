// الاتصال بالداتابيس
// بياخذ الرابط من ملف .env وبيفتح "pool" (مجموعة اتصالات جاهزة)
require("./config");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
