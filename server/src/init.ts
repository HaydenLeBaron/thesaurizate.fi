// This file MUST be imported first to extend Zod globally before any schemas are created
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);
