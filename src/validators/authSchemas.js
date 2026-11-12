const Joi = require("joi");

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().email().max(254).required(),
  password: Joi.string().min(10).max(72).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).max(72).required()
});

const resetRequestSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(10).max(72).required()
});

module.exports = { registerSchema, loginSchema, resetRequestSchema, resetPasswordSchema };
