'use strict';

/**
 * Input Validation Middleware Factory (Zod-Based)
 *
 * Provides a reusable higher-order function that accepts Zod validation schemas
 * for request `body`, `query`, and/or `params` and returns Express middleware
 * that validates the corresponding `req` properties against those schemas.
 *
 * When validation fails, the middleware returns an HTTP 400 response with the
 * standardized application error format:
 *   { status: "error", statusCode: 400, message: "Validation failed: <details>" }
 *
 * When all schemas pass, control is forwarded to the next middleware or route
 * handler via `next()`.
 *
 * Also re-exports the `z` schema builder from Zod so that consumer route files
 * can import both the middleware factory and the schema builder from a single
 * location:
 *
 * @example
 *   const { validateInput, z } = require('../middleware/validateInput');
 *
 *   // Reject unexpected body on GET routes
 *   const noBodySchema = { body: z.object({}).strict().optional() };
 *   router.get('/', validateInput(noBodySchema), (req, res) => { ... });
 *
 * @module src/middleware/validateInput
 */

// SECURITY: Input validation middleware — rejects malformed or unexpected request payloads to prevent injection attacks
const { z } = require('zod');

/**
 * Creates an Express middleware function that validates request properties
 * against the provided Zod schemas.
 *
 * @param {Object} schemas - Object with optional Zod schema properties
 * @param {import('zod').ZodSchema} [schemas.body] - Schema to validate req.body
 * @param {import('zod').ZodSchema} [schemas.query] - Schema to validate req.query
 * @param {import('zod').ZodSchema} [schemas.params] - Schema to validate req.params
 * @returns {Function} Express middleware function with signature (req, res, next)
 */
const validateInput = (schemas = {}) => {
  return (req, res, next) => {
    // If no schemas are provided, skip validation and proceed immediately
    const schemaKeys = Object.keys(schemas);
    if (schemaKeys.length === 0) {
      return next();
    }

    // Iterate over each schema key (body, query, params) and validate
    for (const key of schemaKeys) {
      const schema = schemas[key];
      if (!schema) {
        continue;
      }

      // Use safeParse for non-throwing validation — returns { success, data, error }
      const result = schema.safeParse(req[key]);

      if (!result.success) {
        // Format human-readable error details from Zod's error array.
        // Each error has a `path` (array of field path segments) and `message`.
        // Prefix each error with the request property name (body, query, params)
        // for clear identification of which part of the request failed validation.
        const errorDetails = result.error.errors
          .map((err) => {
            const fieldPath = err.path.length > 0
              ? `${key}.${err.path.join('.')}`
              : key;
            return `${fieldPath}: ${err.message}`;
          })
          .join('; ');

        // Return immediately on validation failure to prevent processing invalid data
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: `Validation failed: ${errorDetails}`
        });
      }
    }

    // All schemas validated successfully — pass control to the route handler
    next();
  };
};

module.exports = { validateInput, z };
