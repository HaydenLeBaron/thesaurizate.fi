import request from 'supertest';
import { app } from './app';

describe('Health API', () => {
  describe('GET /health', () => {
    it('should return status ok', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /v2/ping', () => {
    it('should return status ok and version v2', async () => {
      const response = await request(app)
        .get('/v2/ping')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok', version: 'v2' });
    });
  });
});
