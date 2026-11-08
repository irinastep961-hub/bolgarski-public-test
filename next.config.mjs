/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Разрешаем открывать dev-сервер со смартфона по адресу в домашней сети.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*'],
};
export default nextConfig;
