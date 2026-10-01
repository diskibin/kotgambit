import type { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validates a body or a query against a contract schema, a failure becomes a ZodError the filter maps to 400. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
