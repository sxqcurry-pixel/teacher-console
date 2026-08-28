import { SetMetadata } from '@nestjs/common';

/** Mark a route / controller as public (no JWT required). */
export const IS_PUBLIC_KEY = 'is-public-route';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
