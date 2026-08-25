import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const redis = {
  get: jest.fn(),
};

const User = {
  findById: jest.fn(),
};

const jwt = {
  verify: jest.fn(),
};

jest.unstable_mockModule("../server.js", () => ({ redis }));
jest.unstable_mockModule("../Models/userModel.js", () => ({ default: User }));
jest.unstable_mockModule("jsonwebtoken", () => ({ default: jwt }));

const { protectRoute } = await import("../middleware/Auth.js");

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_ACCESS_TOKEN = "test-secret";
});

describe("protectRoute", () => {
  test("parses cached user data from Redis and attaches a plain user object", async () => {
    const req = { headers: { token: "abc" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    jwt.verify.mockReturnValue({ userId: "123" });
    redis.get.mockResolvedValue(JSON.stringify({
      _id: "123",
      fullName: "John",
      email: "john@example.com",
      password: "secret",
    }));

    await protectRoute(req, res, next);

    expect(req.user).toEqual(expect.objectContaining({
      _id: "123",
      fullName: "John",
      email: "john@example.com",
    }));
    expect(req.user.password).toBeUndefined();
    expect(User.findById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
