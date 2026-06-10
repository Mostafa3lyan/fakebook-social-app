"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliENT_URL = exports.MAGIC_LINK_SECRET = exports.Email_USER = exports.EMAIL_APP_PASSWORD = exports.GOOGLE_CLIENT_ID = exports.REFRESH_TOKEN_EXPIRES_IN = exports.ACCESS_TOKEN_EXPIRES_IN = exports.SYSTEM_REFRESH_TOKEN_SECRET_KEY = exports.SYSTEM_ACCESS_TOKEN_SECRET_KEY = exports.REFRESH_TOKEN_SECRET_KEY = exports.ACCESS_TOKEN_SECRET_KEY = exports.Encryption_ALGORITHM = exports.ENC_SECRET_KEY = exports.IV_LENGTH = exports.SALT_ROUND = exports.REDIS_URI = exports.DB_URI = exports.APP_NAME = exports.port = exports.NODE_ENV = void 0;
const node_path_1 = require("node:path");
const dotenv_1 = require("dotenv");
exports.NODE_ENV = process.env.NODE_ENV;
const envPath = {
    development: `.env.development`,
    production: `.env.production`,
};
console.log({ env: envPath[exports.NODE_ENV] });
(0, dotenv_1.config)({ path: (0, node_path_1.resolve)(`./config/${envPath[exports.NODE_ENV]}`) });
exports.port = process.env.PORT ?? 7000;
exports.APP_NAME = process.env.APP_NAME;
// DB Uri
exports.DB_URI = process.env.DB_URI;
// Redis Uri
exports.REDIS_URI = process.env.REDIS_URI;
exports.SALT_ROUND = parseInt(process.env.SALT_ROUND ?? "10");
exports.IV_LENGTH = parseInt(process.env.IV_LENGTH ?? "16");
exports.ENC_SECRET_KEY = Buffer.from(process.env.ENC_SECRET_KEY || "");
exports.Encryption_ALGORITHM = process.env.Encryption_ALGORITHM;
// Token
exports.ACCESS_TOKEN_SECRET_KEY = process.env.ACCESS_TOKEN_SECRET_KEY;
exports.REFRESH_TOKEN_SECRET_KEY = process.env.REFRESH_TOKEN_SECRET_KEY;
exports.SYSTEM_ACCESS_TOKEN_SECRET_KEY = process.env.SYSTEM_ACCESS_TOKEN_SECRET_KEY;
exports.SYSTEM_REFRESH_TOKEN_SECRET_KEY = process.env.SYSTEM_REFRESH_TOKEN_SECRET_KEY;
exports.ACCESS_TOKEN_EXPIRES_IN = parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN || "1800");
exports.REFRESH_TOKEN_EXPIRES_IN = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || "31536000");
// Google
exports.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// Nodemailer
exports.EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
exports.Email_USER = process.env.Email_USER;
exports.MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET;
exports.CliENT_URL = process.env.CLIENT_URL;
