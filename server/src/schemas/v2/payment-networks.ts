import { z } from 'zod';
import { AccountsRead } from '../pgzod/index';

// Payment network type
export const PaymentNetworkSchema = z.object({
  type: z.enum(['ACH', 'WIRE']).meta({ description: 'Payment network type', example: 'ACH' }),
  enabled: z.boolean().meta({ description: 'Whether this payment network is enabled', example: true }),
  capabilities: z.array(z.string()).meta({ description: 'Supported capabilities', example: ['credit', 'debit'] }),
}).meta({ id: 'PaymentNetwork' });

// Payment networks response
export const PaymentNetworksResponseSchema = z.object({
  accountId: AccountsRead.shape.id.meta({ description: 'Account UUID', example: '550e8400-e29b-41d4-a716-446655440000' }),
  paymentNetworks: z.array(PaymentNetworkSchema).meta({ description: 'List of supported payment networks' }),
}).meta({ id: 'PaymentNetworksResponse' });

export type PaymentNetwork = z.infer<typeof PaymentNetworkSchema>;
export type PaymentNetworksResponse = z.infer<typeof PaymentNetworksResponseSchema>;
