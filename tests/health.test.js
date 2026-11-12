const request = require("supertest");
const app = require("../src/app");

describe("Health endpoint", () => {
  test("returns API status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
