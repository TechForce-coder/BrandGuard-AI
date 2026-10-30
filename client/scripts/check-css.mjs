import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const result = await server.transformRequest('/src/index.css');
  if (!result?.code) {
    throw new Error('Vite did not return transformed CSS for /src/index.css.');
  }
  console.log('Vite CSS transform passed: /src/index.css');
} finally {
  await server.close();
}
