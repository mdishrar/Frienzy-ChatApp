import { beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.unstable_mockModule("../Models/userModel.js", () => ({
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.unstable_mockModule("argon2", () => ({
  default: {
    hash: jest.fn(),
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule("../lib/utils.js", () => ({
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
}));

jest.unstable_mockModule("../server.js", () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    pipeline: jest.fn(),
  },
}));

jest.unstable_mockModule("../lib/cloudinary.js", () => ({
  default: {
    uploader: {
      upload: jest.fn(),
    },
  },
}));

const { default: User } = await import("../Models/userModel.js");
const argon2 = (await import("argon2")).default;
const { generateAccessToken, generateRefreshToken } = await import("../lib/utils.js");
const { redis } = await import("../server.js");
const { signup, login } = await import("../controllers/UserControllers.js");

const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Signup Controller", () => {
  test("returns 400 when required fields are missing", async () => {
    const req = {
      body: { fullName: "", email: "", password: "", bio: "" },
    };
    const res = createMockResponse();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Please fill all the input fields",
    });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("returns 400 when an account already exists", async () => {
    User.findOne.mockResolvedValue({ _id: "1", email: "test@gmail.com" });

    const req = {
      body: { fullName: "John", email: "test@gmail.com", password: "123456", bio: "Developer" },
    };
    const res = createMockResponse();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Account already exists",
    });
  });

  test("creates an account successfully and sets auth cookies", async () => {
    const pipeline = {
      set: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    redis.pipeline.mockReturnValue(pipeline);
    User.findOne.mockResolvedValue(null);
    argon2.hash.mockResolvedValue("hashed-password");
    User.create.mockResolvedValue({
      _id: "123",
      fullName: "John",
      email: "test@gmail.com",
      password: "hashed-password",
      bio: "Developer",
      toObject: function () {
        return { _id: this._id, fullName: this.fullName, email: this.email, bio: this.bio };
      },
    });
    generateAccessToken.mockResolvedValue("access-token");
    generateRefreshToken.mockResolvedValue("refresh-token");
    redis.set.mockResolvedValue("OK");

    const req = {
      body: { fullName: "John", email: "test@gmail.com", password: "123456", bio: "Developer" },
    };
    const res = createMockResponse();

    await signup(req, res);

    expect(argon2.hash).toHaveBeenCalledWith("123456", {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    expect(User.create).toHaveBeenCalledWith({
      fullName: "John",
      email: "test@gmail.com",
      password: "hashed-password",
      bio: "Developer",
    });
    expect(generateAccessToken).toHaveBeenCalledWith("123");
    expect(generateRefreshToken).toHaveBeenCalledWith("123");
    expect(redis.pipeline).toHaveBeenCalled();
    expect(pipeline.set).toHaveBeenCalledTimes(3);
    expect(pipeline.exec).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      userData: expect.any(Object),
      accessToken: "access-token",
      message: "Account Created Successfully",
    });
  });
});

describe("Login Controller", () => {
  test("returns 400 when required fields are missing", async () => {
    const req = { body: { email: "", password: "" } };
    const res = createMockResponse();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Please fill all the input fields",
    });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("returns 404 when an account does not exist", async () => {
    User.findOne.mockResolvedValue(null);

    const req = { body: { email: "test@gmail.com", password: "123456" } };
    const res = createMockResponse();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Account does not exist",
    });
  });

  test("returns 401 when the password is incorrect", async () => {
    User.findOne.mockResolvedValue({
      _id: "123",
      email: "test@gmail.com",
      password: "hashed-password",
      toObject: function () {
        return { _id: this._id, email: this.email, fullName: this.fullName, bio: this.bio };
      },
    });
    argon2.verify.mockResolvedValue(false);

    const req = { body: { email: "test@gmail.com", password: "wrong-password" } };
    const res = createMockResponse();

    await login(req, res);

    expect(argon2.verify).toHaveBeenCalledWith("hashed-password", "wrong-password");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Incorrect password",
    });
  });

  test("logs in successfully and issues auth tokens", async () => {
    User.findOne.mockResolvedValue({
      _id: "123",
      email: "test@gmail.com",
      password: "hashed-password",
      fullName: "John",
      bio: "Developer",
      toObject: function () {
        return { _id: this._id, email: this.email, fullName: this.fullName, bio: this.bio };
      },
    });
    redis.get.mockResolvedValue(null);
    argon2.verify.mockResolvedValue(true);
    generateAccessToken.mockResolvedValue("access-token");
    generateRefreshToken.mockResolvedValue("refresh-token");
    redis.set.mockResolvedValue("OK");

    const req = { body: { email: "test@gmail.com", password: "123456" } };
    const res = createMockResponse();

    await login(req, res);

    expect(argon2.verify).toHaveBeenCalledWith("hashed-password", "123456");
    expect(generateRefreshToken).toHaveBeenCalledWith("123");
    expect(redis.set).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      userData: expect.any(Object),
      accessToken: "access-token",
      message: "Logged in successfully",
    });
  });
});