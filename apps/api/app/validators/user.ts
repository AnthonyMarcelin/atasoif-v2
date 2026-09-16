import vine from '@vinejs/vine'

/**
 * Shared rules for email and password.
 */
const email = () => vine.string().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

/**
 * Pseudo rules (signup + profile):
 * - length 2-32
 * - charset: letters, digits, `.` `_` `-` only
 * - unique among users (DB unique index on `users.pseudo`)
 * Column allows null; signup keeps it optional, profile update requires a value.
 */
const pseudoRule = () =>
  vine
    .string()
    .minLength(2)
    .maxLength(32)
    .regex(/^[a-zA-Z0-9._-]+$/)

/**
 * Validator to use when performing self-signup
 * Optional `pseudo` lets the Angular register form persist display name at signup (E1-T05).
 */
export const signupValidator = vine.create({
  fullName: vine.string().maxLength(255).nullable().optional(),
  pseudo: pseudoRule().unique({ table: 'users', column: 'pseudo' }).optional(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})

/**
 * Authenticated profile update (E1-T06).
 * Uniqueness excludes the current user via `meta.userId`.
 * `isPublic` controls future social discoverability (E6); default false at signup.
 */
export const updateProfileValidator = vine.withMetaData<{ userId: number }>().create({
  pseudo: pseudoRule().unique({
    table: 'users',
    column: 'pseudo',
    filter: (query, _value, field) => {
      query.whereNot('id', field.meta.userId)
    },
  }),
  isPublic: vine.boolean(),
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
