import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Static, TSchema } from '@sinclair/typebox';

type SchemaTypes = {
  Querystring?: TSchema;
  Params?: TSchema;
  Body?: TSchema;
  Headers?: TSchema;
  Response?: TSchema;
};

export function createTypedHandler<
  S extends SchemaTypes,
  Handler extends (
    request: FastifyRequest<{
      Querystring: S['Querystring'] extends TSchema
        ? Static<S['Querystring']>
        : unknown;
      Params: S['Params'] extends TSchema ? Static<S['Params']> : unknown;
      Body: S['Body'] extends TSchema ? Static<S['Body']> : unknown;
      Headers: S['Headers'] extends TSchema ? Static<S['Headers']> : unknown;
    }>,
    reply: FastifyReply,
  ) => Promise<unknown> | unknown,
>(_schema: S, handler: Handler): Handler {
  return handler;
}

export type TypedRequest<S extends SchemaTypes> = FastifyRequest<{
  Querystring: S['Querystring'] extends TSchema
    ? Static<S['Querystring']>
    : unknown;
  Params: S['Params'] extends TSchema ? Static<S['Params']> : unknown;
  Body: S['Body'] extends TSchema ? Static<S['Body']> : unknown;
  Headers: S['Headers'] extends TSchema ? Static<S['Headers']> : unknown;
}>;
