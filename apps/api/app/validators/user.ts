import vine from '@vinejs/vine'

/**
 * Shared rules for email and password.
 */
const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

/**
 * Validator to use when performing self-signup
 * Optional `pseudo` lets the Angular register form persist display name at signup (E1-T05).
 * Profile update for pseudo / isPublic remains E1-T06.
 */
export const signupValidator = vine.create({
  fullName: vine.string().maxLength(255).nullable().optional(),
  pseudo: vine
    .string()
    .minLength(2)
    .maxLength(32)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .unique({ table: 'users', column: 'pseudo' })
    .optional(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})

/**
 * Validator to use before validating user credentials
 * during login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

export const verifyEmailValidator = vine.create({
  token: vine.string().minLength(1),
})

export const forgotPasswordValidator = vine.create({
  email: email(),
})

export const resetPasswordValidator = vine.create({
  token: vine.string().minLength(1),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})
